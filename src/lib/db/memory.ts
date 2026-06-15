import {
  Prisma,
  ShipmentStatus,
  TripStatus,
  TripLegStatus,
  ShipmentLegStatus,
  EscrowStatus,
  type Shipment,
  type Item,
  type TripLeg,
  type AuditActorType,
  type EscrowRecord,
  type HandoffRecord,
} from "@prisma/client";
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
  RestrictionCheckData,
  MatchRepository,
  TripLegMatchInfo,
  AssignTravelerInput,
  AssignTravelerResult,
  ReleaseMatchInput,
  ReleaseMatchResult,
} from "./ports";

/**
 * In-memory repository fakes for unit tests. They mimic the Prisma adapter's
 * behaviour — including optimistic-concurrency version checks and status-history /
 * audit appends — so service tests exercise the real orchestration logic.
 */

const D = (n: number) => new Prisma.Decimal(n);
const uuid = () => crypto.randomUUID();

export interface StatusHistoryEntry {
  shipmentId: string;
  fromStatus: ShipmentStatus | null;
  toStatus: ShipmentStatus;
  actorType: AuditActorType;
  actorId: string | undefined;
  reason: string | undefined;
}

export class InMemoryShipmentRepository implements ShipmentRepository {
  readonly shipments = new Map<string, ShipmentWithItems>();
  readonly statusHistory: StatusHistoryEntry[] = [];

  async create(data: CreateShipmentData): Promise<ShipmentWithItems> {
    const id = uuid();
    const now = new Date();
    const items: Item[] = data.items.map((it) => ({
      id: uuid(),
      shipmentId: id,
      shipmentLegId: null,
      category: it.category,
      description: it.description,
      declaredWeightKg: D(it.declaredWeightKg),
      actualWeightKg: null,
      declaredValueEtb: it.declaredValueEtb != null ? D(it.declaredValueEtb) : null,
      sealId: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    }));

    const shipment: ShipmentWithItems = {
      id,
      senderId: data.senderId,
      receiverName: data.receiverName,
      receiverPhone: data.receiverPhone,
      receiverUserId: null,
      originRegion: data.originRegion,
      destinationRegion: data.destinationRegion,
      status: data.initialStatus,
      version: 0,
      idempotencyKey: data.idempotencyKey ?? null,
      pricingSnapshot: data.pricingSnapshot as unknown as Prisma.JsonValue,
      carrierFeeEtb: D(data.carrierFeeEtb),
      aggregatorFeeEtb: D(data.aggregatorFeeEtb),
      platformFeeEtb: D(data.platformFeeEtb),
      insurancePremiumEtb: D(data.insurancePremiumEtb),
      taxRate: D(0),
      taxAmountEtb: D(data.taxAmountEtb),
      totalPriceEtb: D(data.totalPriceEtb),
      currency: "ETB",
      insuranceOptedIn: data.insuranceOptedIn,
      countryCode: data.countryCode,
      createdAt: now,
      updatedAt: now,
      createdBy: null,
      deletedAt: null,
      items,
    };
    this.shipments.set(id, shipment);
    this.statusHistory.push({
      shipmentId: id,
      fromStatus: null,
      toStatus: data.initialStatus,
      actorType: "SYSTEM",
      actorId: undefined,
      reason: "created",
    });
    return shipment;
  }

  async findById(id: string): Promise<ShipmentWithItems | null> {
    return this.shipments.get(id) ?? null;
  }

  async listBySender(senderId: string): Promise<Shipment[]> {
    return [...this.shipments.values()].filter((s) => s.senderId === senderId);
  }

  async findBySenderIdempotencyKey(
    senderId: string,
    key: string,
  ): Promise<ShipmentWithItems | null> {
    return (
      [...this.shipments.values()].find(
        (s) => s.senderId === senderId && s.idempotencyKey === key,
      ) ?? null
    );
  }

  async applyTransition(
    input: ApplyTransitionInput,
  ): Promise<ApplyTransitionResult> {
    const current = this.shipments.get(input.shipmentId);
    if (!current) return { ok: false, reason: "NOT_FOUND" };
    if (current.version !== input.expectedVersion) {
      return { ok: false, reason: "VERSION_CONFLICT" };
    }
    const updated: ShipmentWithItems = {
      ...current,
      status: input.toStatus,
      version: current.version + 1,
      updatedAt: new Date(),
    };
    this.shipments.set(current.id, updated);
    this.statusHistory.push({
      shipmentId: current.id,
      fromStatus: current.status,
      toStatus: input.toStatus,
      actorType: input.actorType,
      actorId: input.actorId,
      reason: input.reason,
    });
    return { ok: true, shipment: updated };
  }
}

/**
 * Escrow fake. Shares the shipment store with InMemoryShipmentRepository so that
 * "create escrow + transition shipment" happens against one in-memory state — the
 * single-threaded analogue of the Prisma adapter's $transaction.
 */
export class InMemoryEscrowRepository implements EscrowRepository {
  /** Keyed by shipmentId (escrow is 1—1 with a shipment). */
  readonly escrows = new Map<string, EscrowRecord>();

  constructor(private readonly shipmentsRepo: InMemoryShipmentRepository) {}

  async armShipment(input: ArmEscrowInput): Promise<ArmEscrowResult> {
    const shipment = this.shipmentsRepo.shipments.get(input.shipmentId);
    if (!shipment) return { ok: false, reason: "NOT_FOUND" };
    if (this.escrows.has(input.shipmentId)) {
      return { ok: false, reason: "ALREADY_EXISTS" };
    }
    if (shipment.version !== input.expectedVersion) {
      return { ok: false, reason: "VERSION_CONFLICT" };
    }

    const now = new Date();
    const escrow: EscrowRecord = {
      id: uuid(),
      shipmentId: input.shipmentId,
      amountEtb: D(input.amountEtb),
      currency: "ETB",
      holderType: input.holderType,
      holderId: input.holderId ?? null,
      status: EscrowStatus.PENDING,
      releaseCondition: input.releaseCondition,
      heldAt: null,
      releasedAt: null,
      refundedAt: null,
      releasedBy: null,
      providerRef: null,
      createdAt: now,
      updatedAt: now,
    };
    this.escrows.set(input.shipmentId, escrow);

    const res = await this.shipmentsRepo.applyTransition({
      shipmentId: input.shipmentId,
      expectedVersion: input.expectedVersion,
      toStatus: input.toStatus,
      actorType: input.actorType,
      ...(input.actorId ? { actorId: input.actorId } : {}),
      reason: "escrow armed",
    });
    if (!res.ok) {
      this.escrows.delete(input.shipmentId);
      return res;
    }
    return { ok: true, escrow, shipment: res.shipment };
  }

  async findByShipmentId(shipmentId: string): Promise<EscrowRecord | null> {
    return this.escrows.get(shipmentId) ?? null;
  }

  async applyChange(
    input: ApplyEscrowChangeInput,
  ): Promise<ApplyEscrowChangeResult> {
    const escrow = this.escrows.get(input.shipmentId);
    const shipment = this.shipmentsRepo.shipments.get(input.shipmentId);
    if (!escrow || !shipment) return { ok: false, reason: "NOT_FOUND" };
    if (
      input.shipmentToStatus &&
      (input.expectedVersion === undefined ||
        shipment.version !== input.expectedVersion)
    ) {
      return { ok: false, reason: "VERSION_CONFLICT" };
    }

    const now = new Date();
    const updatedEscrow: EscrowRecord = {
      ...escrow,
      status: input.escrowToStatus,
      heldAt: input.escrowToStatus === EscrowStatus.HELD ? now : escrow.heldAt,
      releasedAt:
        input.escrowToStatus === EscrowStatus.RELEASED ? now : escrow.releasedAt,
      refundedAt:
        input.escrowToStatus === EscrowStatus.REFUNDED ? now : escrow.refundedAt,
      releasedBy: input.releasedBy ?? escrow.releasedBy,
      updatedAt: now,
    };
    this.escrows.set(input.shipmentId, updatedEscrow);

    let resultShipment = shipment;
    if (input.shipmentToStatus) {
      const res = await this.shipmentsRepo.applyTransition({
        shipmentId: input.shipmentId,
        expectedVersion: input.expectedVersion!,
        toStatus: input.shipmentToStatus,
        actorType: input.actorType,
        ...(input.actorId ? { actorId: input.actorId } : {}),
        ...(input.reason ? { reason: input.reason } : {}),
      });
      if (!res.ok) {
        this.escrows.set(input.shipmentId, escrow); // roll back the escrow change
        return res;
      }
      resultShipment = res.shipment;
    }
    return { ok: true, escrow: updatedEscrow, shipment: resultShipment };
  }
}

/**
 * Handoff fake. Shares the shipment store so "create handoff (+ item updates +
 * restriction check) + transition shipment" is one in-memory unit, mirroring the
 * Prisma adapter's $transaction.
 */
export class InMemoryHandoffRepository implements HandoffRepository {
  readonly handoffs: HandoffRecord[] = [];
  readonly restrictionChecks: (RestrictionCheckData & { shipmentId: string })[] = [];

  constructor(private readonly shipmentsRepo: InMemoryShipmentRepository) {}

  async record(input: RecordHandoffInput): Promise<RecordHandoffResult> {
    const shipment = this.shipmentsRepo.shipments.get(input.shipmentId);
    if (!shipment) return { ok: false, reason: "NOT_FOUND" };
    if (shipment.version !== input.expectedVersion) {
      return { ok: false, reason: "VERSION_CONFLICT" };
    }

    const now = new Date();
    const handoff: HandoffRecord = {
      id: uuid(),
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
      geoLat: input.geoLat != null ? D(input.geoLat) : null,
      geoLng: input.geoLng != null ? D(input.geoLng) : null,
      capturedAt: input.capturedAt,
      createdAt: now,
    };

    // Item side effects (mutate in place so the post-transition shipment reflects them).
    if (input.itemActualWeights) {
      for (const w of input.itemActualWeights) {
        const item = shipment.items.find((i) => i.id === w.itemId);
        if (item) item.actualWeightKg = D(w.actualWeightKg);
      }
    }
    if (input.itemSealId) {
      for (const item of shipment.items) item.sealId = input.itemSealId;
    }
    if (input.restrictionCheck) {
      this.restrictionChecks.push({
        shipmentId: input.shipmentId,
        ...input.restrictionCheck,
      });
    }

    const res = await this.shipmentsRepo.applyTransition({
      shipmentId: input.shipmentId,
      expectedVersion: input.expectedVersion,
      toStatus: input.toStatus,
      actorType: input.actorType,
      ...(input.actorId ? { actorId: input.actorId } : {}),
      ...(input.reason ? { reason: input.reason } : {}),
      handoffRecordId: handoff.id,
    });
    if (!res.ok) return res;

    this.handoffs.push(handoff);
    return { ok: true, handoff, shipment: res.shipment };
  }

  async listByShipment(shipmentId: string): Promise<HandoffRecord[]> {
    return this.handoffs.filter((h) => h.shipmentId === shipmentId);
  }
}

export class InMemoryConfigRepository implements ConfigRepository {
  constructor(private readonly values: Record<string, number> = {}) {}
  async getNumber(key: string): Promise<number | null> {
    return key in this.values ? this.values[key]! : null;
  }
}

interface FakeShipmentLeg {
  id: string;
  shipmentId: string;
  tripLegId: string;
  travelerId: string;
  status: ShipmentLegStatus;
}

/**
 * Match fake. Trip-leg match snapshots are injected by tests (`legs`); assignment
 * decrements the leg's capacity and creates a ShipmentLeg, release restores it —
 * each atomic with the shipment transition via the shared shipment store.
 */
export class InMemoryMatchRepository implements MatchRepository {
  readonly legs = new Map<string, TripLegMatchInfo>();
  readonly shipmentLegs: FakeShipmentLeg[] = [];

  constructor(private readonly shipmentsRepo: InMemoryShipmentRepository) {}

  async getTripLegMatchInfo(tripLegId: string): Promise<TripLegMatchInfo | null> {
    return this.legs.get(tripLegId) ?? null;
  }

  async assignTraveler(input: AssignTravelerInput): Promise<AssignTravelerResult> {
    const shipment = this.shipmentsRepo.shipments.get(input.shipmentId);
    if (!shipment) return { ok: false, reason: "NOT_FOUND" };
    if (shipment.version !== input.expectedVersion) {
      return { ok: false, reason: "VERSION_CONFLICT" };
    }
    const leg = this.legs.get(input.tripLegId);
    if (!leg) return { ok: false, reason: "NOT_FOUND" };
    if (leg.legStatus !== TripLegStatus.ACTIVE || leg.tripStatus !== TripStatus.ACTIVE) {
      return { ok: false, reason: "LEG_INACTIVE" };
    }
    if (leg.availableCapacityKg < input.weightKg) {
      return { ok: false, reason: "CAPACITY" };
    }

    leg.availableCapacityKg -= input.weightKg;
    const sl: FakeShipmentLeg = {
      id: uuid(),
      shipmentId: input.shipmentId,
      tripLegId: input.tripLegId,
      travelerId: input.travelerId,
      status: ShipmentLegStatus.MATCHED,
    };
    this.shipmentLegs.push(sl);

    const res = await this.shipmentsRepo.applyTransition({
      shipmentId: input.shipmentId,
      expectedVersion: input.expectedVersion,
      toStatus: input.toStatus,
      actorType: "USER",
      ...(input.actorId ? { actorId: input.actorId } : {}),
      reason: "matched to traveler",
    });
    if (!res.ok) {
      leg.availableCapacityKg += input.weightKg;
      this.shipmentLegs.pop();
      return res;
    }
    return { ok: true, shipment: res.shipment };
  }

  async releaseMatch(input: ReleaseMatchInput): Promise<ReleaseMatchResult> {
    const shipment = this.shipmentsRepo.shipments.get(input.shipmentId);
    if (!shipment) return { ok: false, reason: "NOT_FOUND" };
    if (shipment.version !== input.expectedVersion) {
      return { ok: false, reason: "VERSION_CONFLICT" };
    }
    const sl = this.shipmentLegs.find(
      (s) => s.shipmentId === input.shipmentId && s.status === ShipmentLegStatus.MATCHED,
    );
    if (sl) {
      sl.status = ShipmentLegStatus.CANCELLED;
      const leg = this.legs.get(sl.tripLegId);
      if (leg) leg.availableCapacityKg += input.weightKg;
    }
    const res = await this.shipmentsRepo.applyTransition({
      shipmentId: input.shipmentId,
      expectedVersion: input.expectedVersion,
      toStatus: input.toStatus,
      actorType: input.actorType,
      ...(input.actorId ? { actorId: input.actorId } : {}),
      reason: input.reason ?? "match released",
    });
    if (!res.ok) return res;
    return { ok: true, shipment: res.shipment };
  }
}

export class InMemoryTripRepository implements TripRepository {
  readonly trips = new Map<string, TripWithLegs>();
  /** Candidates returned by searchCandidates — set by tests. */
  candidates: TravelerCandidate[] = [];

  async create(data: CreateTripData): Promise<TripWithLegs> {
    const id = uuid();
    const now = new Date();
    const legs: TripLeg[] = data.legs.map((l) => ({
      id: uuid(),
      tripId: id,
      sequence: l.sequence,
      originRegion: l.originRegion,
      destinationRegion: l.destinationRegion,
      originHubId: null,
      destinationHubId: null,
      departAt: l.departAt,
      arriveAt: l.arriveAt ?? null,
      totalCapacityKg: D(l.totalCapacityKg),
      availableCapacityKg: D(l.totalCapacityKg),
      status: TripLegStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
    }));
    const trip: TripWithLegs = {
      id,
      travelerId: data.travelerId,
      status: TripStatus.ACTIVE,
      mode: data.mode,
      countryCode: data.countryCode,
      version: 0,
      createdAt: now,
      updatedAt: now,
      createdBy: null,
      deletedAt: null,
      legs,
    };
    this.trips.set(id, trip);
    return trip;
  }

  async listByTraveler(travelerId: string): Promise<TripWithLegs[]> {
    return [...this.trips.values()].filter((t) => t.travelerId === travelerId);
  }

  async searchCandidates(): Promise<TravelerCandidate[]> {
    return this.candidates;
  }
}

export class InMemoryRuleRepository implements RuleRepository {
  constructor(public rules: RuleInput[] = []) {}
  async findActive(): Promise<RuleInput[]> {
    return this.rules;
  }
}

export class InMemoryPricingRepository implements PricingRepository {
  constructor(public pricing: PricingRule | null = null) {}
  async findActiveCorridor(): Promise<PricingRule | null> {
    return this.pricing;
  }
}

/** Build a full in-memory Repositories bundle for service tests. */
export function makeInMemoryRepositories(opts?: {
  rules?: RuleInput[];
  pricing?: PricingRule | null;
  config?: Record<string, number>;
}): Repositories & {
  shipments: InMemoryShipmentRepository;
  trips: InMemoryTripRepository;
  escrows: InMemoryEscrowRepository;
  handoffs: InMemoryHandoffRepository;
  config: InMemoryConfigRepository;
  match: InMemoryMatchRepository;
} {
  const shipments = new InMemoryShipmentRepository();
  return {
    shipments,
    trips: new InMemoryTripRepository(),
    rules: new InMemoryRuleRepository(opts?.rules ?? []),
    pricing: new InMemoryPricingRepository(opts?.pricing ?? null),
    escrows: new InMemoryEscrowRepository(shipments),
    handoffs: new InMemoryHandoffRepository(shipments),
    config: new InMemoryConfigRepository(opts?.config ?? {}),
    match: new InMemoryMatchRepository(shipments),
  };
}
