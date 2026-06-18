import { describe, it, expect } from "vitest";
import { TripMode, RestrictionDirection } from "@prisma/client";
import type { RuleInput } from "@/lib/domain/types";
import type { TravelerCandidate } from "@/lib/domain/matching";
import { makeInMemoryRepositories } from "@/lib/db/memory";
import { TripService } from "./trip-service";
import { MatchingService } from "./matching-service";

const SPICES_RULE: RuleInput = {
  id: "spices",
  itemCategory: "SPICES",
  corridorCode: null,
  maxWeightKg: 5,
  maxValueEtb: null,
  maxUnitsPerTraveler: null,
  frequencySensitive: false,
  maxWeightKgFrequent: null,
  requiresDeclaration: false,
  requiresSpecialPermit: false,
  prohibited: false,
  dutyApplies: false,
  dutyNote: null,
  direction: RestrictionDirection.BOTH,
  effectiveFrom: new Date("2026-01-01"),
  effectiveUntil: null,
};

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

describe("TripService", () => {
  it("creates a trip with active legs at full capacity", async () => {
    const repos = makeInMemoryRepositories({ kycStatuses: { t1: "VERIFIED" } });
    const svc = new TripService(repos);
    const trip = await svc.create({
      travelerId: "t1",
      mode: TripMode.ROAD,
      countryCode: "ET",
      legs: [
        {
          sequence: 1,
          originRegion: "Addis Ababa",
          destinationRegion: "Hawassa",
          departAt: new Date("2026-07-01T06:00:00Z"),
          totalCapacityKg: 8,
        },
      ],
    });
    expect(trip.legs).toHaveLength(1);
    expect(Number(trip.legs[0]!.availableCapacityKg)).toBe(8);
    expect(await svc.listForTraveler("t1")).toHaveLength(1);
  });

  it("rejects a leg whose arrival precedes departure", async () => {
    const repos = makeInMemoryRepositories({ kycStatuses: { t1: "VERIFIED" } });
    const svc = new TripService(repos);
    await expect(
      svc.create({
        travelerId: "t1",
        mode: TripMode.FLIGHT,
        countryCode: "ET",
        legs: [
          {
            sequence: 1,
            originRegion: "A",
            destinationRegion: "B",
            departAt: new Date("2026-07-01T10:00:00Z"),
            arriveAt: new Date("2026-07-01T09:00:00Z"),
            totalCapacityKg: 5,
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("MatchingService", () => {
  it("ranks eligible travelers by frequency and applies the category crowding limit", async () => {
    const repos = makeInMemoryRepositories({ rules: [SPICES_RULE] });
    repos.trips.candidates = [
      candidate({ travelerId: "frequent", tripCountLast90Days: 9 }),
      candidate({ travelerId: "rare", tripCountLast90Days: 1 }),
      // already carrying 4kg spices; +2kg would exceed the 5kg limit → filtered
      candidate({ travelerId: "crowded", categoryWeightAcceptedKg: 4 }),
    ];
    const svc = new MatchingService(repos);

    const ranked = await svc.findMatches({
      originRegion: "Addis Ababa",
      destinationRegion: "Hawassa",
      windowStart: new Date("2026-07-01T00:00:00Z"),
      windowEnd: new Date("2026-07-02T00:00:00Z"),
      itemCategory: "SPICES",
      itemWeightKg: 2,
      countryCode: "ET",
    });

    expect(ranked.map((c) => c.travelerId)).toEqual(["rare", "frequent"]);
  });
});
