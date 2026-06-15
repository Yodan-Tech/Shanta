import { describe, it, expect } from "vitest";
import {
  type TravelerCandidate,
  type MatchCriteria,
  isEligible,
  filterEligibleTravelers,
  rankTravelers,
} from "./matching";

function candidate(p: Partial<TravelerCandidate> & { travelerId: string }): TravelerCandidate {
  return {
    tripLegId: `leg-${p.travelerId}`,
    departAt: new Date("2026-07-01T08:00:00Z"),
    availableCapacityKg: 10,
    tripCountLast90Days: 0,
    kycVerified: true,
    active: true,
    categoryWeightAcceptedKg: 0,
    ...p,
  };
}

const criteria: MatchCriteria = { itemWeightKg: 2, categoryLimitKg: 5 };

describe("isEligible", () => {
  it("accepts an active, verified traveler with capacity and no crowding", () => {
    expect(isEligible(candidate({ travelerId: "a" }), criteria)).toBe(true);
  });

  it("rejects unverified or suspended travelers", () => {
    expect(isEligible(candidate({ travelerId: "a", kycVerified: false }), criteria)).toBe(false);
    expect(isEligible(candidate({ travelerId: "a", active: false }), criteria)).toBe(false);
  });

  it("rejects insufficient capacity", () => {
    expect(isEligible(candidate({ travelerId: "a", availableCapacityKg: 1 }), criteria)).toBe(false);
  });

  it("rejects when crowding would exceed the category limit", () => {
    // 4 already + 2 new > 5 limit
    expect(isEligible(candidate({ travelerId: "a", categoryWeightAcceptedKg: 4 }), criteria)).toBe(false);
  });
});

describe("filterEligibleTravelers", () => {
  it("keeps only eligible candidates", () => {
    const list = [
      candidate({ travelerId: "ok" }),
      candidate({ travelerId: "no-cap", availableCapacityKg: 0.5 }),
      candidate({ travelerId: "unverified", kycVerified: false }),
    ];
    expect(filterEligibleTravelers(list, criteria).map((c) => c.travelerId)).toEqual(["ok"]);
  });
});

describe("rankTravelers (Constraint 2.1)", () => {
  it("prefers lower 90-day frequency, then earlier departure", () => {
    const list = [
      candidate({ travelerId: "frequent", tripCountLast90Days: 9 }),
      candidate({ travelerId: "rare", tripCountLast90Days: 1 }),
      candidate({ travelerId: "rare-later", tripCountLast90Days: 1, departAt: new Date("2026-07-02T08:00:00Z") }),
    ];
    expect(rankTravelers(list, criteria).map((c) => c.travelerId)).toEqual([
      "rare",
      "rare-later",
      "frequent",
    ]);
  });

  it("excludes ineligible candidates from the ranking", () => {
    const list = [
      candidate({ travelerId: "frequent-eligible", tripCountLast90Days: 9 }),
      candidate({ travelerId: "rare-ineligible", tripCountLast90Days: 0, active: false }),
    ];
    expect(rankTravelers(list, criteria).map((c) => c.travelerId)).toEqual([
      "frequent-eligible",
    ]);
  });
});
