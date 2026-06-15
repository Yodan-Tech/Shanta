import { checkCrowding } from "./rules-engine";

/**
 * Matching — the pure parts of traveler matching (docs/DATA_MODEL.md "Core
 * Queries"). The DB query that produces candidates lives in the persistence
 * milestone; this module decides eligibility and ordering over candidate shapes.
 *
 * Constraint 2.1: prefer LOWER-frequency travelers (spread load across a broad,
 * rotating pool — never optimise for a small high-frequency core).
 */

export interface TravelerCandidate {
  tripLegId: string;
  travelerId: string;
  departAt: Date;
  availableCapacityKg: number;
  /** 90-day trip count (Constraint 2.1 ranking signal). */
  tripCountLast90Days: number;
  kycVerified: boolean;
  active: boolean;
  /** Weight already accepted on this trip leg in the item's category. */
  categoryWeightAcceptedKg: number;
}

export interface MatchCriteria {
  itemWeightKg: number;
  /** Per-traveler/per-trip cap for the item's category (crowding constraint). */
  categoryLimitKg: number;
}

/** Constraint 2.1 ordering: lower 90-day frequency first, then earlier departure. */
export function compareByFrequencyThenDepart(
  a: TravelerCandidate,
  b: TravelerCandidate,
): number {
  if (a.tripCountLast90Days !== b.tripCountLast90Days) {
    return a.tripCountLast90Days - b.tripCountLast90Days;
  }
  return a.departAt.getTime() - b.departAt.getTime();
}

export function isEligible(
  candidate: TravelerCandidate,
  criteria: MatchCriteria,
): boolean {
  if (!candidate.active || !candidate.kycVerified) return false;
  if (candidate.availableCapacityKg < criteria.itemWeightKg) return false;
  return checkCrowding(
    candidate.categoryWeightAcceptedKg,
    criteria.itemWeightKg,
    criteria.categoryLimitKg,
  );
}

export function filterEligibleTravelers(
  candidates: TravelerCandidate[],
  criteria: MatchCriteria,
): TravelerCandidate[] {
  return candidates.filter((c) => isEligible(c, criteria));
}

/** Eligible candidates, ordered by the Constraint 2.1 preference. */
export function rankTravelers(
  candidates: TravelerCandidate[],
  criteria: MatchCriteria,
): TravelerCandidate[] {
  return filterEligibleTravelers(candidates, criteria).sort(
    compareByFrequencyThenDepart,
  );
}
