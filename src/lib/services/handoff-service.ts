import {
  ShipmentStatus,
  HandoffType,
  CaptureMethod,
  AuditActorType,
  RestrictionDirection,
  RestrictionCheckTrigger,
  RestrictionCheckResult,
  type HandoffRecord,
} from "@prisma/client";
import { assertTransition } from "@/lib/domain/state-machine";
import { evaluateShipment } from "@/lib/domain/rules-engine";
import type { ItemInput, ShipmentEvaluation } from "@/lib/domain/types";
import { ApiError } from "@/lib/api/errors";
import type {
  Repositories,
  ShipmentWithItems,
  RecordHandoffInput,
  RecordHandoffResult,
} from "@/lib/db/ports";

export const WEIGHT_DISCREPANCY_THRESHOLD_KEY =
  "intake.weight_discrepancy_threshold_kg";
const DEFAULT_WEIGHT_DISCREPANCY_KG = 0.5;

export interface HandoffOutcome {
  handoff: HandoffRecord;
  shipment: ShipmentWithItems;
}

export interface IntakeOutcome extends HandoffOutcome {
  weightDiscrepancy: boolean;
  restriction: ShipmentEvaluation;
}

/**
 * HandoffService — the hub verification chain (Constraint 2.2), the spine of trust.
 * Each step derives its guard context from server-side evidence (a HandoffRecord),
 * never from a client flag, and advances the shipment via the guarded state machine
 * so the verification order (intake → verify → seal) is structurally impossible to
 * skip. Re-runs the rules engine on the ACTUAL weighed values at intake (2.4).
 */
export class HandoffService {
  constructor(private readonly repos: Repositories) {}

  /**
   * Hub intake (aggregator). Weighs + photographs the parcel, requires an explicit
   * cash check (2.5), re-runs the rules engine on actual weights, and advances
   * AWAITING_HUB_INTAKE → AT_ORIGIN_HUB. If the weighed total diverges from the
   * declared total beyond the AppConfig threshold, or the re-check fails, it routes
   * the shipment to WEIGHT_DISCREPANCY.
   */
  async intake(input: {
    shipmentId: string;
    operatorId: string;
    photoUrls: string[];
    itemWeights: { itemId: string; actualWeightKg: number }[];
    cashChecked: boolean;
    geoLat?: number;
    geoLng?: number;
  }): Promise<IntakeOutcome> {
    const shipment = await this.requireShipment(input.shipmentId);
    if (input.photoUrls.length < 1) {
      throw ApiError.unprocessable("An intake photo is required.");
    }
    if (!input.cashChecked) {
      throw ApiError.unprocessable(
        "The operator must confirm the explicit cash check before intake (Constraint 2.5).",
      );
    }
    assertTransition(shipment.status, ShipmentStatus.AT_ORIGIN_HUB, {
      hasHandoff: true,
    });

    // Map declared item ids → actual weighed values; require a weight per item.
    const weightById = new Map(input.itemWeights.map((w) => [w.itemId, w.actualWeightKg]));
    for (const item of shipment.items) {
      if (!weightById.has(item.id)) {
        throw ApiError.unprocessable(`Missing actual weight for item ${item.id}.`);
      }
    }

    // Re-run the rules engine on ACTUAL weights (Constraint 2.4). No traveler tier is
    // known pre-match, so frequency-sensitive caps use the stricter limit.
    const rules = await this.repos.rules.findActive(shipment.countryCode);
    const items: ItemInput[] = shipment.items.map((it) => ({
      id: it.id,
      category: it.category,
      weightKg: weightById.get(it.id)!,
      ...(it.declaredValueEtb != null ? { valueEtb: Number(it.declaredValueEtb) } : {}),
    }));
    const restriction = evaluateShipment(items, rules, {
      corridorCode: null,
      direction: RestrictionDirection.BOTH,
    });

    const declaredTotal = shipment.items.reduce(
      (s, it) => s + Number(it.declaredWeightKg),
      0,
    );
    const actualTotal = input.itemWeights.reduce((s, w) => s + w.actualWeightKg, 0);
    const threshold =
      (await this.repos.config.getNumber(WEIGHT_DISCREPANCY_THRESHOLD_KEY)) ??
      DEFAULT_WEIGHT_DISCREPANCY_KG;
    const weightDiscrepancy = Math.abs(actualTotal - declaredTotal) > threshold;

    const recorded = await this.record({
      shipmentId: shipment.id,
      handoffType: HandoffType.SENDER_TO_HUB,
      fromActorId: shipment.senderId,
      toActorId: input.operatorId,
      photoUrls: input.photoUrls,
      captureMethod: CaptureMethod.LIVE,
      ...(input.geoLat != null ? { geoLat: input.geoLat } : {}),
      ...(input.geoLng != null ? { geoLng: input.geoLng } : {}),
      capturedAt: new Date(),
      expectedVersion: shipment.version,
      toStatus: ShipmentStatus.AT_ORIGIN_HUB,
      actorType: AuditActorType.USER,
      actorId: input.operatorId,
      reason: "hub intake",
      itemActualWeights: input.itemWeights,
      restrictionCheck: {
        trigger: RestrictionCheckTrigger.HUB_INTAKE,
        result: restriction.result as RestrictionCheckResult,
        detail: {
          declaredTotal,
          actualTotal,
          threshold,
          weightDiscrepancy,
          cashChecked: input.cashChecked,
        },
      },
    });

    // Flag a discrepancy or a failed re-check (re-price/re-rules handled by ops).
    if (weightDiscrepancy || restriction.result === RestrictionCheckResult.FAIL) {
      const flagged = await this.systemTransition(
        recorded.shipment,
        ShipmentStatus.WEIGHT_DISCREPANCY,
        input.operatorId,
        weightDiscrepancy ? "weight discrepancy at intake" : "rules failed at intake",
      );
      return { ...recorded, shipment: flagged, weightDiscrepancy, restriction };
    }
    return { ...recorded, weightDiscrepancy, restriction };
  }

  /**
   * Contents verification (aggregator). Requires ≥1 contents photo and advances
   * AT_ORIGIN_HUB → CONTENTS_VERIFIED. Cannot run before intake, and sealing cannot
   * run before this — enforced by the state machine.
   */
  async verify(input: {
    shipmentId: string;
    operatorId: string;
    photoUrls: string[];
  }): Promise<HandoffOutcome> {
    const shipment = await this.requireShipment(input.shipmentId);
    if (input.photoUrls.length < 1) {
      throw ApiError.unprocessable(
        "At least one contents photo is required to verify (Constraint 2.2).",
      );
    }
    assertTransition(shipment.status, ShipmentStatus.CONTENTS_VERIFIED, {
      hasVerificationPhoto: true,
    });

    return this.record({
      shipmentId: shipment.id,
      handoffType: HandoffType.SENDER_TO_HUB,
      fromActorId: input.operatorId,
      toActorId: input.operatorId,
      photoUrls: input.photoUrls,
      captureMethod: CaptureMethod.LIVE,
      acknowledged: true,
      capturedAt: new Date(),
      expectedVersion: shipment.version,
      toStatus: ShipmentStatus.CONTENTS_VERIFIED,
      actorType: AuditActorType.USER,
      actorId: input.operatorId,
      reason: "contents verified",
    });
  }

  /**
   * Apply the tamper seal (aggregator). Only valid AFTER verification; records the
   * seal id on the handoff and every item, advances CONTENTS_VERIFIED → SEALED, then
   * auto-queues the shipment for matching (SEALED → AWAITING_MATCH).
   */
  async seal(input: {
    shipmentId: string;
    operatorId: string;
    sealId: string;
    photoUrls: string[];
  }): Promise<HandoffOutcome> {
    const shipment = await this.requireShipment(input.shipmentId);
    if (!input.sealId.trim()) throw ApiError.unprocessable("A seal id is required.");
    if (input.photoUrls.length < 1) {
      throw ApiError.unprocessable("A photo of the applied seal is required.");
    }
    assertTransition(shipment.status, ShipmentStatus.SEALED, { sealApplied: true });

    const sealed = await this.record({
      shipmentId: shipment.id,
      handoffType: HandoffType.SENDER_TO_HUB,
      fromActorId: input.operatorId,
      toActorId: input.operatorId,
      photoUrls: input.photoUrls,
      captureMethod: CaptureMethod.LIVE,
      sealApplied: true,
      sealId: input.sealId,
      capturedAt: new Date(),
      expectedVersion: shipment.version,
      toStatus: ShipmentStatus.SEALED,
      actorType: AuditActorType.USER,
      actorId: input.operatorId,
      reason: "tamper seal applied",
      itemSealId: input.sealId,
    });

    // Enter the matching queue (system step).
    const queued = await this.systemTransition(
      sealed.shipment,
      ShipmentStatus.AWAITING_MATCH,
      input.operatorId,
      "queued for matching",
    );
    return { ...sealed, shipment: queued };
  }

  async listForShipment(shipmentId: string): Promise<HandoffRecord[]> {
    return this.repos.handoffs.listByShipment(shipmentId);
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private async requireShipment(id: string): Promise<ShipmentWithItems> {
    const shipment = await this.repos.shipments.findById(id);
    if (!shipment) throw ApiError.notFound("Shipment not found.");
    return shipment;
  }

  private async record(input: RecordHandoffInput): Promise<HandoffOutcome> {
    const result = await this.repos.handoffs.record(input);
    return this.unwrap(result, input.expectedVersion);
  }

  /** A guarded SYSTEM-actor transition with no handoff (flagging / queueing). */
  private async systemTransition(
    shipment: ShipmentWithItems,
    to: ShipmentStatus,
    actorId: string,
    reason: string,
  ): Promise<ShipmentWithItems> {
    assertTransition(shipment.status, to, {});
    const res = await this.repos.shipments.applyTransition({
      shipmentId: shipment.id,
      expectedVersion: shipment.version,
      toStatus: to,
      actorType: AuditActorType.SYSTEM,
      actorId,
      reason,
    });
    if (!res.ok) {
      throw ApiError.conflict("Shipment was modified concurrently; reload and retry.");
    }
    return res.shipment;
  }

  private unwrap(result: RecordHandoffResult, version: number): HandoffOutcome {
    if (result.ok) return { handoff: result.handoff, shipment: result.shipment };
    if (result.reason === "NOT_FOUND") throw ApiError.notFound("Shipment not found.");
    throw ApiError.conflict(
      "Shipment was modified concurrently; reload and retry.",
      { expectedVersion: version },
    );
  }
}
