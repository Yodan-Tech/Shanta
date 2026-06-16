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
  HandoffRecord,
  HandoffType,
  CaptureMethod,
  RestrictionCheckTrigger,
  RestrictionCheckResult,
  CustomsFrequencyTier,
  TripLegStatus,
  TripStatus,
  Notification,
} from "@prisma/client";
import type { RuleInput, PricingRule } from "@/lib/domain/types";
import type { TravelerCandidate } from "@/lib/domain/matching";
import type { NotificationSpec } from "@/lib/domain/notifications";

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

// Re-export so callers don't need two imports.
export type { NotificationSpec } from "@/lib/domain/notifications";

// ── Optimistic state transition ──────────────────────────────────────────────

export interface ApplyTransitionInput {
  shipmentId: string;
  expectedVersion: number;
  toStatus: ShipmentStatus;
  actorType: AuditActorType;
  actorId?: string;
  reason?: string;
  handoffRecordId?: string;
  /** Written atomically inside the same DB transaction. */
  notifications?: NotificationSpec[];
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
  notifications?: NotificationSpec[];
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
  notifications?: NotificationSpec[];
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

// ── Handoff: immutable verification evidence + atomic shipment transition ──────

export interface RestrictionCheckData {
  trigger: RestrictionCheckTrigger;
  result: RestrictionCheckResult;
  itemId?: string;
  failedRuleId?: string;
  detail?: Record<string, unknown>;
  travelerFrequencyTier?: CustomsFrequencyTier;
}

/**
 * Record an immutable HandoffRecord and advance the shipment in ONE transaction,
 * optionally stamping item actual weights / seal id and writing a RestrictionCheck
 * (hub intake re-validation, Constraint 2.4). The guard context for the transition
 * is derived by the service from this same evidence — never trusted from the client.
 */
export interface RecordHandoffInput {
  shipmentId: string;
  shipmentLegId?: string;
  handoffType: HandoffType;
  fromActorId: string;
  toActorId: string;
  photoUrls: string[];
  videoUrl?: string;
  captureMethod: CaptureMethod;
  acknowledgmentText?: string;
  acknowledged?: boolean;
  sealApplied?: boolean;
  sealId?: string;
  sealIntact?: boolean;
  geoLat?: number;
  geoLng?: number;
  capturedAt: Date;
  // Atomic shipment transition driven by this handoff.
  expectedVersion: number;
  toStatus: ShipmentStatus;
  actorType: AuditActorType;
  actorId?: string;
  reason?: string;
  // Optional side effects.
  itemActualWeights?: { itemId: string; actualWeightKg: number }[];
  /** Stamp this seal id onto every item (sealing step). */
  itemSealId?: string;
  restrictionCheck?: RestrictionCheckData;
  notifications?: NotificationSpec[];
}

export type RecordHandoffResult =
  | { ok: true; handoff: HandoffRecord; shipment: ShipmentWithItems }
  | { ok: false; reason: "VERSION_CONFLICT" | "NOT_FOUND" };

export interface HandoffRepository {
  record(input: RecordHandoffInput): Promise<RecordHandoffResult>;
  listByShipment(shipmentId: string): Promise<HandoffRecord[]>;
}

/** Runtime configuration (AppConfig) reads for thresholds/flags. */
export interface ConfigRepository {
  /** Numeric config value by key (AppConfig.value = { value: number }), or null. */
  getNumber(key: string): Promise<number | null>;
}

// ── KYC ──────────────────────────────────────────────────────────────────────

export interface KycQueueItem {
  userId: string;
  phone: string | null;
  fullName: string | null;
  kycStatus: string;
  kycSubmittedAt: Date | null;
  /** Storage path (NOT a signed URL — callers must sign before returning to clients). */
  idDocumentPath: string | null;
}

export interface KycRepository {
  getStatus(userId: string): Promise<string | null>;
  submit(input: { userId: string; idDocumentUrl: string }): Promise<void>;
  approve(input: { userId: string; reviewedBy: string }): Promise<void>;
  reject(input: { userId: string; reviewedBy: string; reason: string }): Promise<void>;
  listPending(limit: number): Promise<KycQueueItem[]>;
}

/** Notification outbox — drain, send, update status. */
export interface NotificationRepository {
  /** Fetch QUEUED/RETRYING rows with attempts < 3, ordered by createdAt asc. */
  drainQueued(limit: number): Promise<Notification[]>;
  markSent(id: string, providerRef?: string): Promise<void>;
  markFailed(id: string): Promise<void>;
  markRetrying(id: string): Promise<void>;
  incrementAttempts(id: string): Promise<void>;
}

/** Profile reads needed by the notification drain worker. */
export interface ProfileRepository {
  getPhone(userId: string): Promise<string | null>;
}

// ── Matching assignment + traveler accept/reject (Constraints 2.1 + 2.2) ───────

/** Server-side snapshot of a trip leg for the match re-check (never sent to clients). */
export interface TripLegMatchInfo {
  tripLegId: string;
  travelerId: string;
  departAt: Date;
  availableCapacityKg: number;
  legStatus: TripLegStatus;
  tripStatus: TripStatus;
  travelerActive: boolean;
  travelerKycVerified: boolean;
  tripCountLast90Days: number;
  /** Weight already accepted on this leg in the given category (crowding, 2.1). */
  categoryWeightAcceptedKg: number;
}

/** Assign a traveler: create the ShipmentLeg, decrement capacity, and transition. Atomic. */
export interface AssignTravelerInput {
  shipmentId: string;
  tripLegId: string;
  travelerId: string;
  weightKg: number;
  expectedVersion: number;
  toStatus: ShipmentStatus;
  actorId?: string;
  notifications?: NotificationSpec[];
}

export type AssignTravelerResult =
  | { ok: true; shipment: ShipmentWithItems }
  | { ok: false; reason: "VERSION_CONFLICT" | "NOT_FOUND" | "CAPACITY" | "LEG_INACTIVE" };

/** Release a match (reject): restore capacity, cancel the ShipmentLeg, and transition. Atomic. */
export interface ReleaseMatchInput {
  shipmentId: string;
  weightKg: number;
  expectedVersion: number;
  toStatus: ShipmentStatus;
  actorType: AuditActorType;
  actorId?: string;
  reason?: string;
  notifications?: NotificationSpec[];
}

export type ReleaseMatchResult =
  | { ok: true; shipment: ShipmentWithItems }
  | { ok: false; reason: "VERSION_CONFLICT" | "NOT_FOUND" };

export interface MatchRepository {
  getTripLegMatchInfo(
    tripLegId: string,
    itemCategory: string,
  ): Promise<TripLegMatchInfo | null>;
  assignTraveler(input: AssignTravelerInput): Promise<AssignTravelerResult>;
  releaseMatch(input: ReleaseMatchInput): Promise<ReleaseMatchResult>;
}

/** Aggregate of all repositories, injected into services. */
export interface Repositories {
  shipments: ShipmentRepository;
  trips: TripRepository;
  rules: RuleRepository;
  pricing: PricingRepository;
  escrows: EscrowRepository;
  handoffs: HandoffRepository;
  config: ConfigRepository;
  match: MatchRepository;
  notifications: NotificationRepository;
  profiles: ProfileRepository;
  kyc: KycRepository;
}
