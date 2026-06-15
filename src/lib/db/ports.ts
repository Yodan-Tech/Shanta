import type {
  Shipment,
  Item,
  Trip,
  TripLeg,
  ShipmentStatus,
  AuditActorType,
  EscrowRecord,
  EscrowStatus,
  EscrowHolderType,
} from "@prisma/client";
import type { RuleInput, PricingRule } from "@/lib/domain/types";
import type { TravelerCandidate } from "@/lib/domain/matching";

/**
 * Repository PORTS — the data-access contract the services depend on. Two
 * implementations exist: a Prisma adapter (src/lib/db/prisma-repositories.ts,
 * production) and in-memory fakes (src/lib/db/memory.ts, tests). Services never
 * import Prisma directly; they orchestrate the pure domain core + these ports.
 *
 * Optimistic concurrency, status-history append, and audit writes live INSIDE
 * the repository (a DB-transaction concern); legality of a transition is decided
 * by the domain state machine in the service.
 */

export type ShipmentWithItems = Shipment & { items: Item[] };
export type TripWithLegs = Trip & { legs: TripLeg[] };

// ── Shipment creation graph ──────────────────────────────────────────────────

export interface CreateItemData {
  category: string;
  description: string;
  declaredWeightKg: number;
  declaredValueEtb?: number | undefined;
}

export interface CreateShipmentData {
  senderId: string;
  receiverName: string;
  receiverPhone: string;
  originRegion: string;
  destinationRegion: string;
  countryCode: string;
  insuranceOptedIn: boolean;
  idempotencyKey?: string;
  items: CreateItemData[];
  // Computed by the service (pricing.ts) before persistence:
  carrierFeeEtb: number;
  aggregatorFeeEtb: number;
  platformFeeEtb: number;
  insurancePremiumEtb: number;
  taxAmountEtb: number;
  totalPriceEtb: number;
  /** Serialisable pricing snapshot; the Prisma adapter casts to InputJsonValue. */
  pricingSnapshot: Record<string, unknown>;
  /** Initial status the shipment is created in (e.g. RULES_VALIDATED). */
  initialStatus: ShipmentStatus;
}

// ── Optimistic state transition ──────────────────────────────────────────────

export interface ApplyTransitionInput {
  shipmentId: string;
  expectedVersion: number;
  toStatus: ShipmentStatus;
  actorType: AuditActorType;
  actorId?: string;
  reason?: string;
  handoffRecordId?: string;
}

export type ApplyTransitionResult =
  | { ok: true; shipment: ShipmentWithItems }
  | { ok: false; reason: "VERSION_CONFLICT" | "NOT_FOUND" };

// ── Trip creation + candidate search ─────────────────────────────────────────

export interface CreateTripLegData {
  sequence: number;
  originRegion: string;
  destinationRegion: string;
  departAt: Date;
  arriveAt?: Date;
  totalCapacityKg: number;
}

export interface CreateTripData {
  travelerId: string;
  mode: Trip["mode"];
  countryCode: string;
  legs: CreateTripLegData[];
}

export interface CandidateSearchCriteria {
  originRegion: string;
  destinationRegion: string;
  windowStart: Date;
  windowEnd: Date;
  itemCategory: string;
}

// ── Escrow: arm-on-create + status changes (each atomic with the shipment) ────

/**
 * Create the PENDING escrow and advance the shipment RULES_VALIDATED →
 * AWAITING_HUB_INTAKE in a single transaction (the "arm" step on shipment create).
 */
export interface ArmEscrowInput {
  shipmentId: string;
  /** Shipment version expected before the AWAITING_HUB_INTAKE transition (0 on create). */
  expectedVersion: number;
  amountEtb: number;
  holderType: EscrowHolderType;
  holderId?: string;
  releaseCondition: string;
  toStatus: ShipmentStatus;
  actorType: AuditActorType;
  actorId?: string;
}

export type ArmEscrowResult =
  | { ok: true; escrow: EscrowRecord; shipment: ShipmentWithItems }
  | { ok: false; reason: "VERSION_CONFLICT" | "NOT_FOUND" | "ALREADY_EXISTS" };

/**
 * Apply an escrow status change, optionally transitioning the shipment in the SAME
 * transaction (release pairs with ESCROW_RELEASED, refund with RETURNED_TO_SENDER;
 * mark-held has no shipment transition here — custody transfer owns that in M6).
 */
export interface ApplyEscrowChangeInput {
  shipmentId: string;
  escrowToStatus: EscrowStatus;
  /** Optional shipment transition applied atomically; omit to change escrow only. */
  shipmentToStatus?: ShipmentStatus;
  /** Required when shipmentToStatus is set — optimistic lock on the shipment. */
  expectedVersion?: number;
  actorType: AuditActorType;
  actorId?: string;
  reason?: string;
  /** AdminUser id recorded on RELEASED. */
  releasedBy?: string;
}

export type ApplyEscrowChangeResult =
  | { ok: true; escrow: EscrowRecord; shipment: ShipmentWithItems }
  | { ok: false; reason: "VERSION_CONFLICT" | "NOT_FOUND" };

// ── Ports ────────────────────────────────────────────────────────────────────

export interface ShipmentRepository {
  create(data: CreateShipmentData): Promise<ShipmentWithItems>;
  findById(id: string): Promise<ShipmentWithItems | null>;
  listBySender(senderId: string): Promise<Shipment[]>;
  findBySenderIdempotencyKey(
    senderId: string,
    key: string,
  ): Promise<ShipmentWithItems | null>;
  applyTransition(input: ApplyTransitionInput): Promise<ApplyTransitionResult>;
}

export interface TripRepository {
  create(data: CreateTripData): Promise<TripWithLegs>;
  listByTraveler(travelerId: string): Promise<TripWithLegs[]>;
  /** Returns matchable traveler candidates for a corridor + window. */
  searchCandidates(
    criteria: CandidateSearchCriteria,
  ): Promise<TravelerCandidate[]>;
}

export interface RuleRepository {
  /** All active restriction rules for a country, mapped to the domain shape. */
  findActive(countryCode: string): Promise<RuleInput[]>;
}

export interface PricingRepository {
  findActiveCorridor(
    originRegion: string,
    destinationRegion: string,
    onDate: Date,
    countryCode: string,
  ): Promise<PricingRule | null>;
}

export interface EscrowRepository {
  /** Create the PENDING escrow + arm the shipment (→ AWAITING_HUB_INTAKE) atomically. */
  armShipment(input: ArmEscrowInput): Promise<ArmEscrowResult>;
  findByShipmentId(shipmentId: string): Promise<EscrowRecord | null>;
  /** Apply an escrow status change (+ optional atomic shipment transition). */
  applyChange(input: ApplyEscrowChangeInput): Promise<ApplyEscrowChangeResult>;
}

/** Aggregate of all repositories, injected into services. */
export interface Repositories {
  shipments: ShipmentRepository;
  trips: TripRepository;
  rules: RuleRepository;
  pricing: PricingRepository;
  escrows: EscrowRepository;
}
