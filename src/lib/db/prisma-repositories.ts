import {
  Prisma,
  ShipmentLegStatus,
  EscrowStatus,
  type ItemRestriction,
  type CorridorPricing,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { RuleInput, PricingRule } from "@/lib/domain/types";
import type { TravelerCandidate } from "@/lib/domain/matching";
import type {
  ShipmentRepository,
  TripRepository,
  RuleRepository,
  PricingRepository,
  EscrowRepository,
  HandoffRepository,
  ConfigRepository,
  Repositories,
  CreateShipmentData,
  CreateTripData,
  ShipmentWithItems,
  TripWithLegs,
  ApplyTransitionInput,
  ApplyTransitionResult,
  ArmEscrowInput,
  ArmEscrowResult,
  ApplyEscrowChangeInput,
  ApplyEscrowChangeResult,
  RecordHandoffInput,
  RecordHandoffResult,
  CandidateSearchCriteria,
} from "./ports";

const num = (d: Prisma.Decimal): number => d.toNumber();

/** Carries a typed failure reason out of a $transaction so it can roll back. */
class TxAbort extends Error {
  constructor(public readonly reason: "VERSION_CONFLICT" | "NOT_FOUND" | "ALREADY_EXISTS") {
    super(reason);
  }
}

/**
 * Apply a shipment transition inside an existing transaction: optimistic version
 * check, status update, status-history append, and audit write. Shared by the
 * shipment repository and the escrow repository (which pairs a money-state change
 * with a shipment transition atomically).
 */
async function txTransitionShipment(
  tx: Prisma.TransactionClient,
  args: {
    shipmentId: string;
    expectedVersion: number;
    toStatus: ApplyTransitionInput["toStatus"];
    actorType: ApplyTransitionInput["actorType"];
    actorId?: string;
    reason?: string;
    handoffRecordId?: string;
  },
): Promise<ApplyTransitionResult> {
  const current = await tx.shipment.findUnique({
    where: { id: args.shipmentId },
    select: { status: true, version: true },
  });
  if (!current) return { ok: false, reason: "NOT_FOUND" as const };
  if (current.version !== args.expectedVersion) {
    return { ok: false, reason: "VERSION_CONFLICT" as const };
  }

  const updated = await tx.shipment.update({
    where: { id: args.shipmentId },
    data: { status: args.toStatus, version: { increment: 1 } },
    include: { items: true },
  });

  await tx.shipmentStatusHistory.create({
    data: {
      shipmentId: args.shipmentId,
      fromStatus: current.status,
      toStatus: args.toStatus,
      actorType: args.actorType,
      actorId: args.actorId ?? null,
      handoffRecordId: args.handoffRecordId ?? null,
      reason: args.reason ?? null,
    },
  });

  await tx.auditLog.create({
    data: {
      actorType: args.actorType,
      actorId: args.actorId ?? "system",
      action: "shipment.state.transition",
      entityType: "Shipment",
      entityId: args.shipmentId,
      beforeState: { status: current.status },
      afterState: { status: args.toStatus },
    },
  });

  return { ok: true as const, shipment: updated };
}

// ── Mappers (Prisma row → domain shape) ──────────────────────────────────────

function ruleFromPrisma(r: ItemRestriction): RuleInput {
  return {
    id: r.id,
    itemCategory: r.itemCategory,
    corridorCode: r.corridorCode,
    maxWeightKg: r.maxWeightKg ? num(r.maxWeightKg) : null,
    maxValueEtb: r.maxValueEtb ? num(r.maxValueEtb) : null,
    frequencySensitive: r.frequencySensitive,
    maxWeightKgFrequent: r.maxWeightKgFrequent ? num(r.maxWeightKgFrequent) : null,
    requiresDeclaration: r.requiresDeclaration,
    requiresSpecialPermit: r.requiresSpecialPermit,
    prohibited: r.prohibited,
    direction: r.direction,
    effectiveFrom: r.effectiveFrom,
    effectiveUntil: r.effectiveUntil,
  };
}

function pricingFromPrisma(p: CorridorPricing): PricingRule {
  return {
    ratePerKgEtb: num(p.ratePerKgEtb),
    minChargeEtb: num(p.minChargeEtb),
    aggregatorFlatFeeEtb: num(p.aggregatorFlatFeeEtb),
    platformCommissionRate: num(p.platformCommissionRate),
    insuranceRate: num(p.insuranceRate),
    taxRate: num(p.taxRate),
  };
}

// ── Shipment repository ──────────────────────────────────────────────────────

export class PrismaShipmentRepository implements ShipmentRepository {
  async create(data: CreateShipmentData): Promise<ShipmentWithItems> {
    return prisma.shipment.create({
      data: {
        senderId: data.senderId,
        receiverName: data.receiverName,
        receiverPhone: data.receiverPhone,
        originRegion: data.originRegion,
        destinationRegion: data.destinationRegion,
        countryCode: data.countryCode,
        insuranceOptedIn: data.insuranceOptedIn,
        idempotencyKey: data.idempotencyKey ?? null,
        status: data.initialStatus,
        carrierFeeEtb: data.carrierFeeEtb,
        aggregatorFeeEtb: data.aggregatorFeeEtb,
        platformFeeEtb: data.platformFeeEtb,
        insurancePremiumEtb: data.insurancePremiumEtb,
        taxAmountEtb: data.taxAmountEtb,
        totalPriceEtb: data.totalPriceEtb,
        pricingSnapshot: data.pricingSnapshot as Prisma.InputJsonValue,
        items: {
          create: data.items.map((it) => ({
            category: it.category,
            description: it.description,
            declaredWeightKg: it.declaredWeightKg,
            declaredValueEtb: it.declaredValueEtb ?? null,
          })),
        },
        statusHistory: {
          create: {
            toStatus: data.initialStatus,
            actorType: "SYSTEM",
            reason: "created",
          },
        },
      },
      include: { items: true },
    });
  }

  async findById(id: string): Promise<ShipmentWithItems | null> {
    return prisma.shipment.findUnique({ where: { id }, include: { items: true } });
  }

  async listBySender(senderId: string) {
    return prisma.shipment.findMany({
      where: { senderId, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });
  }

  async findBySenderIdempotencyKey(senderId: string, key: string) {
    return prisma.shipment.findFirst({
      where: { senderId, idempotencyKey: key },
      include: { items: true },
    });
  }

  async applyTransition(
    input: ApplyTransitionInput,
  ): Promise<ApplyTransitionResult> {
    return prisma.$transaction((tx) =>
      txTransitionShipment(tx, {
        shipmentId: input.shipmentId,
        expectedVersion: input.expectedVersion,
        toStatus: input.toStatus,
        actorType: input.actorType,
        ...(input.actorId ? { actorId: input.actorId } : {}),
        ...(input.reason ? { reason: input.reason } : {}),
        ...(input.handoffRecordId ? { handoffRecordId: input.handoffRecordId } : {}),
      }),
    );
  }
}

// ── Trip repository ──────────────────────────────────────────────────────────

export class PrismaTripRepository implements TripRepository {
  async create(data: CreateTripData): Promise<TripWithLegs> {
    return prisma.trip.create({
      data: {
        travelerId: data.travelerId,
        mode: data.mode,
        countryCode: data.countryCode,
        status: "ACTIVE",
        legs: {
          create: data.legs.map((l) => ({
            sequence: l.sequence,
            originRegion: l.originRegion,
            destinationRegion: l.destinationRegion,
            departAt: l.departAt,
            arriveAt: l.arriveAt ?? null,
            totalCapacityKg: l.totalCapacityKg,
            availableCapacityKg: l.totalCapacityKg,
          })),
        },
      },
      include: { legs: true },
    });
  }

  async listByTraveler(travelerId: string): Promise<TripWithLegs[]> {
    return prisma.trip.findMany({
      where: { travelerId, deletedAt: null },
      include: { legs: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async searchCandidates(
    criteria: CandidateSearchCriteria,
  ): Promise<TravelerCandidate[]> {
    const legs = await prisma.tripLeg.findMany({
      where: {
        originRegion: criteria.originRegion,
        destinationRegion: criteria.destinationRegion,
        departAt: { gte: criteria.windowStart, lte: criteria.windowEnd },
        status: "ACTIVE",
        availableCapacityKg: { gt: 0 },
        trip: {
          status: "ACTIVE",
          traveler: { status: "ACTIVE", kycStatus: "VERIFIED" },
        },
      },
      include: {
        trip: { include: { traveler: { include: { travelProfile: true } } } },
      },
    });

    const candidates: TravelerCandidate[] = [];
    for (const leg of legs) {
      const agg = await prisma.item.aggregate({
        _sum: { declaredWeightKg: true },
        where: {
          category: criteria.itemCategory,
          shipmentLeg: {
            tripLegId: leg.id,
            status: { notIn: [ShipmentLegStatus.CANCELLED, ShipmentLegStatus.RETURNED] },
          },
        },
      });
      const traveler = leg.trip.traveler;
      candidates.push({
        tripLegId: leg.id,
        travelerId: traveler.id,
        departAt: leg.departAt,
        availableCapacityKg: num(leg.availableCapacityKg),
        tripCountLast90Days: traveler.travelProfile?.tripCountLast90Days ?? 0,
        kycVerified: traveler.kycStatus === "VERIFIED",
        active: traveler.status === "ACTIVE",
        categoryWeightAcceptedKg: agg._sum.declaredWeightKg
          ? num(agg._sum.declaredWeightKg)
          : 0,
      });
    }
    return candidates;
  }
}

// ── Rules + pricing repositories ─────────────────────────────────────────────

export class PrismaRuleRepository implements RuleRepository {
  async findActive(countryCode: string): Promise<RuleInput[]> {
    const rows = await prisma.itemRestriction.findMany({ where: { countryCode } });
    return rows.map(ruleFromPrisma);
  }
}

export class PrismaPricingRepository implements PricingRepository {
  async findActiveCorridor(
    originRegion: string,
    destinationRegion: string,
    onDate: Date,
    countryCode: string,
  ): Promise<PricingRule | null> {
    const row = await prisma.corridorPricing.findFirst({
      where: {
        originRegion,
        destinationRegion,
        countryCode,
        effectiveFrom: { lte: onDate },
        OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: onDate } }],
      },
      orderBy: { effectiveFrom: "desc" },
    });
    return row ? pricingFromPrisma(row) : null;
  }
}

// ── Escrow repository ────────────────────────────────────────────────────────

export class PrismaEscrowRepository implements EscrowRepository {
  async armShipment(input: ArmEscrowInput): Promise<ArmEscrowResult> {
    try {
      return await prisma.$transaction(async (tx) => {
        const existing = await tx.escrowRecord.findUnique({
          where: { shipmentId: input.shipmentId },
          select: { id: true },
        });
        if (existing) throw new TxAbort("ALREADY_EXISTS");

        const res = await txTransitionShipment(tx, {
          shipmentId: input.shipmentId,
          expectedVersion: input.expectedVersion,
          toStatus: input.toStatus,
          actorType: input.actorType,
          ...(input.actorId ? { actorId: input.actorId } : {}),
          reason: "escrow armed",
        });
        if (!res.ok) throw new TxAbort(res.reason);

        const escrow = await tx.escrowRecord.create({
          data: {
            shipmentId: input.shipmentId,
            amountEtb: input.amountEtb,
            holderType: input.holderType,
            holderId: input.holderId ?? null,
            releaseCondition: input.releaseCondition,
            status: EscrowStatus.PENDING,
          },
        });
        return { ok: true as const, escrow, shipment: res.shipment };
      });
    } catch (e) {
      if (e instanceof TxAbort) return { ok: false, reason: e.reason };
      throw e;
    }
  }

  async findByShipmentId(shipmentId: string) {
    return prisma.escrowRecord.findUnique({ where: { shipmentId } });
  }

  async applyChange(
    input: ApplyEscrowChangeInput,
  ): Promise<ApplyEscrowChangeResult> {
    try {
      return await prisma.$transaction(async (tx) => {
        const escrow = await tx.escrowRecord.findUnique({
          where: { shipmentId: input.shipmentId },
        });
        if (!escrow) throw new TxAbort("NOT_FOUND");

        let shipment: ShipmentWithItems;
        if (input.shipmentToStatus) {
          const res = await txTransitionShipment(tx, {
            shipmentId: input.shipmentId,
            expectedVersion: input.expectedVersion!,
            toStatus: input.shipmentToStatus,
            actorType: input.actorType,
            ...(input.actorId ? { actorId: input.actorId } : {}),
            ...(input.reason ? { reason: input.reason } : {}),
          });
          if (!res.ok) throw new TxAbort(res.reason);
          shipment = res.shipment;
        } else {
          const s = await tx.shipment.findUnique({
            where: { id: input.shipmentId },
            include: { items: true },
          });
          if (!s) throw new TxAbort("NOT_FOUND");
          shipment = s;
        }

        const now = new Date();
        const updated = await tx.escrowRecord.update({
          where: { shipmentId: input.shipmentId },
          data: {
            status: input.escrowToStatus,
            ...(input.escrowToStatus === EscrowStatus.HELD ? { heldAt: now } : {}),
            ...(input.escrowToStatus === EscrowStatus.RELEASED
              ? { releasedAt: now, releasedBy: input.releasedBy ?? null }
              : {}),
            ...(input.escrowToStatus === EscrowStatus.REFUNDED
              ? { refundedAt: now }
              : {}),
          },
        });

        await tx.auditLog.create({
          data: {
            actorType: input.actorType,
            actorId: input.actorId ?? "system",
            action: "escrow.status.change",
            entityType: "EscrowRecord",
            entityId: escrow.id,
            beforeState: { status: escrow.status },
            afterState: { status: input.escrowToStatus },
          },
        });

        return { ok: true as const, escrow: updated, shipment };
      });
    } catch (e) {
      if (e instanceof TxAbort) {
        // applyChange never produces ALREADY_EXISTS; narrow to its result type.
        const reason = e.reason === "ALREADY_EXISTS" ? "NOT_FOUND" : e.reason;
        return { ok: false, reason };
      }
      throw e;
    }
  }
}

// ── Handoff + config repositories ─────────────────────────────────────────────

export class PrismaHandoffRepository implements HandoffRepository {
  async record(input: RecordHandoffInput): Promise<RecordHandoffResult> {
    try {
      return await prisma.$transaction(async (tx) => {
        const handoff = await tx.handoffRecord.create({
          data: {
            shipmentId: input.shipmentId,
            shipmentLegId: input.shipmentLegId ?? null,
            handoffType: input.handoffType,
            fromActorId: input.fromActorId,
            toActorId: input.toActorId,
            photoUrls: input.photoUrls,
            videoUrl: input.videoUrl ?? null,
            captureMethod: input.captureMethod,
            acknowledgmentText: input.acknowledgmentText ?? null,
            acknowledged: input.acknowledged ?? false,
            sealApplied: input.sealApplied ?? false,
            sealId: input.sealId ?? null,
            sealIntact: input.sealIntact ?? null,
            geoLat: input.geoLat ?? null,
            geoLng: input.geoLng ?? null,
            capturedAt: input.capturedAt,
          },
        });

        for (const w of input.itemActualWeights ?? []) {
          await tx.item.update({
            where: { id: w.itemId },
            data: { actualWeightKg: w.actualWeightKg },
          });
        }
        if (input.itemSealId) {
          await tx.item.updateMany({
            where: { shipmentId: input.shipmentId, deletedAt: null },
            data: { sealId: input.itemSealId },
          });
        }
        if (input.restrictionCheck) {
          const rc = input.restrictionCheck;
          await tx.restrictionCheck.create({
            data: {
              shipmentId: input.shipmentId,
              itemId: rc.itemId ?? null,
              trigger: rc.trigger,
              result: rc.result,
              failedRuleId: rc.failedRuleId ?? null,
              ...(rc.detail ? { detail: rc.detail as Prisma.InputJsonValue } : {}),
              travelerFrequencyTier: rc.travelerFrequencyTier ?? null,
            },
          });
        }

        const res = await txTransitionShipment(tx, {
          shipmentId: input.shipmentId,
          expectedVersion: input.expectedVersion,
          toStatus: input.toStatus,
          actorType: input.actorType,
          ...(input.actorId ? { actorId: input.actorId } : {}),
          ...(input.reason ? { reason: input.reason } : {}),
          handoffRecordId: handoff.id,
        });
        if (!res.ok) throw new TxAbort(res.reason);
        return { ok: true as const, handoff, shipment: res.shipment };
      });
    } catch (e) {
      if (e instanceof TxAbort) {
        const reason = e.reason === "ALREADY_EXISTS" ? "NOT_FOUND" : e.reason;
        return { ok: false, reason };
      }
      throw e;
    }
  }

  async listByShipment(shipmentId: string) {
    return prisma.handoffRecord.findMany({
      where: { shipmentId },
      orderBy: { capturedAt: "asc" },
    });
  }
}

export class PrismaConfigRepository implements ConfigRepository {
  async getNumber(key: string): Promise<number | null> {
    const row = await prisma.appConfig.findUnique({ where: { key } });
    if (!row) return null;
    const v = row.value as { value?: unknown } | null;
    const n = typeof v?.value === "number" ? v.value : Number(v?.value);
    return Number.isFinite(n) ? n : null;
  }
}

/** Production repositories backed by Prisma (Supabase Postgres). */
export function getRepositories(): Repositories {
  return {
    shipments: new PrismaShipmentRepository(),
    trips: new PrismaTripRepository(),
    rules: new PrismaRuleRepository(),
    pricing: new PrismaPricingRepository(),
    escrows: new PrismaEscrowRepository(),
    handoffs: new PrismaHandoffRepository(),
    config: new PrismaConfigRepository(),
  };
}
