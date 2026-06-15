import {
  ShipmentStatus,
  RestrictionDirection,
  RestrictionCheckResult,
  AuditActorType,
  type Shipment,
} from "@prisma/client";
import { assertTransition, type TransitionContext } from "@/lib/domain/state-machine";
import { evaluateShipment } from "@/lib/domain/rules-engine";
import { computePrice } from "@/lib/domain/pricing";
import type { ItemInput, PriceBreakdown } from "@/lib/domain/types";
import { ApiError } from "@/lib/api/errors";
import { EscrowService } from "@/lib/services/escrow-service";
import type {
  Repositories,
  ShipmentWithItems,
  CreateItemData,
} from "@/lib/db/ports";

export interface CreateShipmentInput {
  senderId: string;
  receiverName: string;
  receiverPhone: string;
  originRegion: string;
  destinationRegion: string;
  countryCode: string;
  insuranceOptedIn: boolean;
  idempotencyKey?: string;
  items: CreateItemData[];
}

export interface TransitionInput {
  shipmentId: string;
  expectedVersion: number;
  toStatus: ShipmentStatus;
  actorType: AuditActorType;
  actorId?: string;
  reason?: string;
  context?: TransitionContext;
}

export interface CreateShipmentResult {
  shipment: ShipmentWithItems;
  price: PriceBreakdown;
}

/**
 * ShipmentService — the core sender/shipment backend. Orchestrates the pure domain
 * core (rules engine, pricing, state machine) over injected repositories. No
 * framework or Prisma coupling, so it is fully unit-tested with in-memory fakes.
 */
export class ShipmentService {
  private readonly escrow: EscrowService;

  constructor(private readonly repos: Repositories) {
    this.escrow = new EscrowService(repos);
  }

  async create(input: CreateShipmentInput): Promise<CreateShipmentResult> {
    // Idempotency: a repeated create with the same key returns the original.
    if (input.idempotencyKey) {
      const existing = await this.repos.shipments.findBySenderIdempotencyKey(
        input.senderId,
        input.idempotencyKey,
      );
      if (existing) {
        return { shipment: existing, price: snapshotToBreakdown(existing) };
      }
    }

    // 1) Rules engine at submission (Constraint 2.4). Domestic Phase 1 → BOTH
    //    direction (only universal rules apply; ENTRY/EXIT are international).
    const rules = await this.repos.rules.findActive(input.countryCode);
    const items: ItemInput[] = input.items.map((it) => ({
      category: it.category,
      weightKg: it.declaredWeightKg,
      ...(it.declaredValueEtb !== undefined ? { valueEtb: it.declaredValueEtb } : {}),
    }));
    const evaluation = evaluateShipment(items, rules, {
      corridorCode: null,
      direction: RestrictionDirection.BOTH,
    });
    if (evaluation.result === RestrictionCheckResult.FAIL) {
      throw ApiError.rulesFailed("One or more items cannot be shipped.", {
        items: evaluation.items.filter(
          (i) => i.result === RestrictionCheckResult.FAIL,
        ),
      });
    }

    // 2) Pricing from the active corridor rate.
    const pricingRule = await this.repos.pricing.findActiveCorridor(
      input.originRegion,
      input.destinationRegion,
      new Date(),
      input.countryCode,
    );
    if (!pricingRule) {
      throw ApiError.unprocessable(
        `No pricing configured for ${input.originRegion} → ${input.destinationRegion}.`,
      );
    }
    const totalWeightKg = input.items.reduce(
      (sum, it) => sum + it.declaredWeightKg,
      0,
    );
    const declaredValueEtb = input.items.reduce(
      (sum, it) => sum + (it.declaredValueEtb ?? 0),
      0,
    );
    const price = computePrice(
      {
        weightKg: totalWeightKg,
        declaredValueEtb,
        insuranceOptedIn: input.insuranceOptedIn,
      },
      pricingRule,
    );

    // 3) Persist the shipment graph in RULES_VALIDATED.
    const created = await this.repos.shipments.create({
      senderId: input.senderId,
      receiverName: input.receiverName,
      receiverPhone: input.receiverPhone,
      originRegion: input.originRegion,
      destinationRegion: input.destinationRegion,
      countryCode: input.countryCode,
      insuranceOptedIn: input.insuranceOptedIn,
      ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
      items: input.items,
      carrierFeeEtb: price.carrierFeeEtb,
      aggregatorFeeEtb: price.aggregatorFeeEtb,
      platformFeeEtb: price.platformFeeEtb,
      insurancePremiumEtb: price.insurancePremiumEtb,
      taxAmountEtb: price.taxAmountEtb,
      totalPriceEtb: price.totalPriceEtb,
      pricingSnapshot: { rule: pricingRule, breakdown: price },
      initialStatus: ShipmentStatus.RULES_VALIDATED,
    });

    // 4) Arm the manual hub escrow (PENDING) and advance → AWAITING_HUB_INTAKE in
    //    one transaction (OQ-1; closes the create→intake gap, Milestone 4).
    const { shipment } = await this.escrow.armForShipment(created);

    return { shipment, price };
  }

  async getForSender(
    id: string,
    senderId: string,
  ): Promise<ShipmentWithItems> {
    const shipment = await this.repos.shipments.findById(id);
    // Don't leak existence of other senders' shipments.
    if (!shipment || shipment.senderId !== senderId) {
      throw ApiError.notFound("Shipment not found.");
    }
    return shipment;
  }

  async listForSender(senderId: string): Promise<Shipment[]> {
    return this.repos.shipments.listBySender(senderId);
  }

  /** Guarded state transition with optimistic concurrency. */
  async transition(input: TransitionInput): Promise<ShipmentWithItems> {
    const current = await this.repos.shipments.findById(input.shipmentId);
    if (!current) throw ApiError.notFound("Shipment not found.");

    // Domain legality + guards (throws DomainError → mapped to 409/422).
    assertTransition(current.status, input.toStatus, input.context ?? {});

    const result = await this.repos.shipments.applyTransition({
      shipmentId: input.shipmentId,
      expectedVersion: input.expectedVersion,
      toStatus: input.toStatus,
      actorType: input.actorType,
      ...(input.actorId ? { actorId: input.actorId } : {}),
      ...(input.reason ? { reason: input.reason } : {}),
    });

    if (!result.ok) {
      if (result.reason === "NOT_FOUND") {
        throw ApiError.notFound("Shipment not found.");
      }
      throw ApiError.conflict(
        "Shipment was modified concurrently; reload and retry.",
        { expectedVersion: input.expectedVersion, currentVersion: current.version },
      );
    }
    return result.shipment;
  }
}

/** Reconstruct a PriceBreakdown from a stored pricing snapshot (idempotent return). */
function snapshotToBreakdown(shipment: ShipmentWithItems): PriceBreakdown {
  const snap = shipment.pricingSnapshot as { breakdown?: PriceBreakdown } | null;
  if (snap?.breakdown) return snap.breakdown;
  return {
    carrierFeeEtb: Number(shipment.carrierFeeEtb),
    aggregatorFeeEtb: Number(shipment.aggregatorFeeEtb),
    platformFeeEtb: Number(shipment.platformFeeEtb),
    insurancePremiumEtb: Number(shipment.insurancePremiumEtb),
    taxAmountEtb: Number(shipment.taxAmountEtb),
    totalPriceEtb: Number(shipment.totalPriceEtb),
    currency: "ETB",
  };
}
