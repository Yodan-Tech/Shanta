import { describe, it, expect, beforeEach } from "vitest";
import {
  ShipmentStatus,
  EscrowStatus,
  TripLegStatus,
  TripStatus,
  RestrictionDirection,
} from "@prisma/client";
import type { PricingRule, RuleInput } from "@/lib/domain/types";
import type { TripLegMatchInfo } from "@/lib/db/ports";
import { makeInMemoryRepositories } from "@/lib/db/memory";
import { ShipmentService, type CreateShipmentInput } from "./shipment-service";
import { HandoffService } from "./handoff-service";
import { MatchService } from "./match-service";

const PRICING: PricingRule = {
  ratePerKgEtb: 120, minChargeEtb: 200, aggregatorFlatFeeEtb: 50,
  platformCommissionRate: 0.15, insuranceRate: 0.02, taxRate: 0,
};
const SPICES_RULE: RuleInput = {
  id: "spices", itemCategory: "SPICES", corridorCode: null, maxWeightKg: 5,
  maxValueEtb: null, frequencySensitive: false, maxWeightKgFrequent: null,
  requiresDeclaration: false, requiresSpecialPermit: false, prohibited: false,
  direction: RestrictionDirection.BOTH, effectiveFrom: new Date("2026-01-01"), effectiveUntil: null,
};
const CONFIG = { "intake.weight_discrepancy_threshold_kg": 0.5 };
const OP = "operator-1";
const TRAVELER = "traveler-1";
const TRIP_LEG = "tripleg-1";

function baseInput(over: Partial<CreateShipmentInput> = {}): CreateShipmentInput {
  return {
    senderId: "sender-1", receiverName: "Almaz", receiverPhone: "+251911223344",
    originRegion: "Addis Ababa", destinationRegion: "Hawassa", countryCode: "ET",
    insuranceOptedIn: false,
    items: [{ category: "SPICES", description: "berbere", declaredWeightKg: 3 }],
    ...over,
  };
}

function leg(over: Partial<TripLegMatchInfo> = {}): TripLegMatchInfo {
  return {
    tripLegId: TRIP_LEG, travelerId: TRAVELER, departAt: new Date("2026-07-01T08:00:00Z"),
    availableCapacityKg: 10, legStatus: TripLegStatus.ACTIVE, tripStatus: TripStatus.ACTIVE,
    travelerActive: true, travelerKycVerified: true, tripCountLast90Days: 2,
    categoryWeightAcceptedKg: 0, ...over,
  };
}

let repos: ReturnType<typeof makeInMemoryRepositories>;
let ship: ShipmentService;
let handoff: HandoffService;
let match: MatchService;

beforeEach(() => {
  repos = makeInMemoryRepositories({ rules: [SPICES_RULE], pricing: PRICING, config: CONFIG });
  ship = new ShipmentService(repos);
  handoff = new HandoffService(repos);
  match = new MatchService(repos);
});

/** Create + drive a shipment all the way to AWAITING_MATCH via the M5 chain. */
async function awaitingMatch() {
  const { shipment } = await ship.create(baseInput());
  const id = shipment.id;
  const itemId = shipment.items[0]!.id;
  await handoff.intake({ shipmentId: id, operatorId: OP, photoUrls: ["i.jpg"], itemWeights: [{ itemId, actualWeightKg: 3 }], cashChecked: true });
  await handoff.verify({ shipmentId: id, operatorId: OP, photoUrls: ["c.jpg"] });
  await handoff.seal({ shipmentId: id, operatorId: OP, sealId: "SEAL-1", photoUrls: ["s.jpg"] });
  return id;
}

describe("MatchService.match (Constraint 2.1)", () => {
  it("assigns a traveler, decrements capacity, and never leaks frequency", async () => {
    const id = await awaitingMatch();
    repos.match.legs.set(TRIP_LEG, leg());
    const out = await match.match({ shipmentId: id, tripLegId: TRIP_LEG, operatorId: OP, countryCode: "ET" });
    expect(out.shipment.status).toBe(ShipmentStatus.MATCHED_TO_TRAVELER);
    expect(repos.match.legs.get(TRIP_LEG)!.availableCapacityKg).toBe(7); // 10 - 3
    // Constraint 2.1: the response must not expose traveler frequency.
    expect(JSON.stringify(out)).not.toMatch(/tripCount|frequency/i);
  });

  it("rejects an over-capacity match (422)", async () => {
    const id = await awaitingMatch();
    repos.match.legs.set(TRIP_LEG, leg({ availableCapacityKg: 2 })); // < 3kg
    await expect(
      match.match({ shipmentId: id, tripLegId: TRIP_LEG, operatorId: OP, countryCode: "ET" }),
    ).rejects.toMatchObject({ code: "UNPROCESSABLE" });
  });

  it("rejects a crowded match — category cap would be exceeded (422)", async () => {
    const id = await awaitingMatch();
    repos.match.legs.set(TRIP_LEG, leg({ categoryWeightAcceptedKg: 4 })); // 4 + 3 > 5 cap
    await expect(
      match.match({ shipmentId: id, tripLegId: TRIP_LEG, operatorId: OP, countryCode: "ET" }),
    ).rejects.toMatchObject({ code: "UNPROCESSABLE" });
  });

  it("rejects an unverified / inactive traveler (422)", async () => {
    const id = await awaitingMatch();
    repos.match.legs.set(TRIP_LEG, leg({ travelerKycVerified: false }));
    await expect(
      match.match({ shipmentId: id, tripLegId: TRIP_LEG, operatorId: OP, countryCode: "ET" }),
    ).rejects.toMatchObject({ code: "UNPROCESSABLE" });
  });
});

describe("MatchService review → accept → reject (Constraint 2.2)", () => {
  async function matched() {
    const id = await awaitingMatch();
    repos.match.legs.set(TRIP_LEG, leg());
    await match.match({ shipmentId: id, tripLegId: TRIP_LEG, operatorId: OP, countryCode: "ET" });
    await match.review({ shipmentId: id, travelerId: TRAVELER });
    return id;
  }

  it("accepts with an acknowledgment + intact seal → WITH_TRAVELER and holds escrow", async () => {
    const id = await matched();
    const out = await match.accept({
      shipmentId: id, travelerId: TRAVELER,
      acknowledgmentText: "I have inspected the contents and they match the declared description.",
      sealIntact: true,
    });
    expect(out.shipment.status).toBe(ShipmentStatus.WITH_TRAVELER);
    expect(out.escrowHeld).toBe(true);
    expect((await repos.escrows.findByShipmentId(id))!.status).toBe(EscrowStatus.HELD);
  });

  it("cannot accept without an acknowledgment", async () => {
    const id = await matched();
    await expect(
      match.accept({ shipmentId: id, travelerId: TRAVELER, acknowledgmentText: "  ", sealIntact: true }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("cannot accept when the seal is not intact", async () => {
    const id = await matched();
    await expect(
      match.accept({ shipmentId: id, travelerId: TRAVELER, acknowledgmentText: "ok", sealIntact: false }),
    ).rejects.toMatchObject({ code: "UNPROCESSABLE" });
  });

  it("reject restores capacity and re-queues to AWAITING_MATCH", async () => {
    const id = await matched();
    expect(repos.match.legs.get(TRIP_LEG)!.availableCapacityKg).toBe(7); // decremented at match
    const out = await match.reject({ shipmentId: id, travelerId: TRAVELER, reason: "schedule changed" });
    expect(out.shipment.status).toBe(ShipmentStatus.AWAITING_MATCH);
    expect(repos.match.legs.get(TRIP_LEG)!.availableCapacityKg).toBe(10); // restored
  });
});
