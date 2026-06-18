import type {
  RestrictionDirection,
  RestrictionCheckResult,
  CustomsFrequencyTier,
} from "@prisma/client";

/**
 * Shared domain types for the pure business core (state machine, rules engine,
 * pricing, matching). These deliberately use plain numbers/strings rather than
 * Prisma row types or Prisma.Decimal so the core stays I/O-free and trivially
 * testable; the persistence layer (later milestone) maps Prisma rows ↔ these shapes.
 */

/** Who is performing an action. Superset of user Roles (adds SYSTEM/ADMIN). */
export type Actor =
  | "SENDER"
  | "TRAVELER"
  | "AGGREGATOR"
  | "RECEIVER"
  | "SYSTEM"
  | "ADMIN";

/** A typed domain error so callers can switch on `code` (→ HTTP status later). */
export class DomainError extends Error {
  constructor(
    public readonly code: DomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export type DomainErrorCode =
  | "ILLEGAL_TRANSITION"
  | "GUARD_UNMET"
  | "TERMINAL_STATE"
  | "INVALID_INPUT";

// ── Rules engine I/O shapes ──────────────────────────────────────────────────

/** A single declared item to validate against the rules engine. */
export interface ItemInput {
  /** Item id (optional; echoed back in per-item results). */
  id?: string;
  category: string;
  weightKg: number;
  valueEtb?: number;
  /** Number of units of this item (e.g. 2 laptops). Defaults to 1. */
  units?: number;
  /** True if the sender supplied a special permit for this item. */
  hasPermit?: boolean;
}

/** A rules-engine rule (mirror of the relevant ItemRestriction columns). */
export interface RuleInput {
  id: string;
  itemCategory: string;
  corridorCode: string | null;
  maxWeightKg: number | null;
  maxValueEtb: number | null;
  /** Per-person personal-use unit cap (e.g. 1 laptop/person into ET). null = no unit cap. */
  maxUnitsPerTraveler: number | null;
  frequencySensitive: boolean;
  maxWeightKgFrequent: number | null;
  requiresDeclaration: boolean;
  requiresSpecialPermit: boolean;
  prohibited: boolean;
  /** Transparency: item is declarable/taxable at customs on this route. */
  dutyApplies: boolean;
  dutyNote: string | null;
  direction: RestrictionDirection;
  effectiveFrom: Date;
  effectiveUntil: Date | null;
}

/** Result of evaluating one item. */
export interface ItemEvaluation {
  itemId: string | undefined;
  category: string;
  result: RestrictionCheckResult;
  failedRuleId?: string;
  limitAppliedKg?: number;
  /** Per-person unit cap that applied (when a unit-count rule governed the item). */
  limitAppliedUnits?: number;
  reason?: string;
  /** Transparency surfacing (not a failure): item is declarable/taxable here. */
  dutyApplies?: boolean;
  dutyNote?: string;
}

/** Result of evaluating a whole shipment (overall + per item). */
export interface ShipmentEvaluation {
  result: RestrictionCheckResult;
  items: ItemEvaluation[];
}

export interface EvaluateOptions {
  corridorCode?: string | null;
  direction: RestrictionDirection;
  /** Matched traveler's tier; omit at submission to apply the stricter limit. */
  travelerTier?: CustomsFrequencyTier;
  /** Evaluation date for rule effectiveness windows (defaults to now). */
  onDate?: Date;
}

// ── Pricing I/O shapes ───────────────────────────────────────────────────────

export interface PricingRule {
  ratePerKgEtb: number;
  minChargeEtb: number;
  aggregatorFlatFeeEtb: number;
  /** Fraction, e.g. 0.15 for 15%. */
  platformCommissionRate: number;
  /** Fraction of declared value. */
  insuranceRate: number;
  /** Fraction, e.g. 0.15 for VAT. 0 in Phase 1 (OQ-7). */
  taxRate: number;
}

export interface PricingInput {
  weightKg: number;
  declaredValueEtb?: number;
  insuranceOptedIn: boolean;
}

export interface PriceBreakdown {
  carrierFeeEtb: number;
  aggregatorFeeEtb: number;
  platformFeeEtb: number;
  insurancePremiumEtb: number;
  taxAmountEtb: number;
  totalPriceEtb: number;
  currency: "ETB";
}
