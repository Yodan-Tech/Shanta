import { describe, it, expect, beforeEach } from "vitest";
import { ShipmentStatus, CaptureMethod } from "@prisma/client";
import type { PricingRule, RuleInput } from "@/lib/domain/types";
import { DomainError } from "@/lib/domain/types";
import { RestrictionDirection } from "@prisma/client";
import { makeInMemoryRepositories } from "@/lib/db/memory";
import { ShipmentService, type CreateShipmentInput } from "./shipment-service";
import { HandoffService } from "./handoff-service";

const PRICING: PricingRule = {
  ratePerKgEtb: 120,
  minChargeEtb: 200,
  aggregatorFlatFeeEtb: 50,
  platformCommissionRate: 0.15,
  insuranceRate: 0.02,
  taxRate: 0,
};

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

const CONFIG = { "intake.weight_discrepancy_threshold_kg": 0.5 };

function baseInput(over: Partial<CreateShipmentInput> = {}): CreateShipmentInput {
  return {
    senderId: "sender-1",
    receiverName: "Almaz",
    receiverPhone: "+251911223344",
    originRegion: "Addis Ababa",
    destinationRegion: "Hawassa",
    countryCode: "ET",
    insuranceOptedIn: false,
    items: [{ category: "SPICES", description: "berbere", declaredWeightKg: 3 }],
    ...over,
  };
}

let repos: ReturnType<typeof makeInMemoryRepositories>;
let ship: ShipmentService;
let handoff: HandoffService;

beforeEach(() => {
  repos = makeInMemoryRepositories({ rules: [SPICES_RULE], pricing: PRICING, config: CONFIG });
  ship = new ShipmentService(repos);
  handoff = new HandoffService(repos);
});

async function newShipment(over: Partial<CreateShipmentInput> = {}) {
  const { shipment } = await ship.create(baseInput(over));
  return shipment; // AWAITING_HUB_INTAKE, version 1
}

const OP = "operator-1";

describe("HandoffService.intake", () => {
  it("weighs, advances to AT_ORIGIN_HUB, and re-runs the rules engine", async () => {
    const s = await newShipment();
    const out = await handoff.intake({
      shipmentId: s.id,
      operatorId: OP,
      photoUrls: ["intake.jpg"],
      itemWeights: [{ itemId: s.items[0]!.id, actualWeightKg: 3.2 }],
      cashChecked: true,
    });
    expect(out.shipment.status).toBe(ShipmentStatus.AT_ORIGIN_HUB);
    expect(out.weightDiscrepancy).toBe(false);
    expect(out.handoff.captureMethod).toBe(CaptureMethod.LIVE);
    expect(out.handoff.handoffType).toBe("SENDER_TO_HUB");
    expect(repos.handoffs.restrictionChecks.at(-1)?.trigger).toBe("HUB_INTAKE");
  });

  it("flags WEIGHT_DISCREPANCY when actual weight diverges beyond the threshold", async () => {
    const s = await newShipment();
    const out = await handoff.intake({
      shipmentId: s.id,
      operatorId: OP,
      photoUrls: ["intake.jpg"],
      itemWeights: [{ itemId: s.items[0]!.id, actualWeightKg: 6 }], // declared 3, gap 3 > 0.5
      cashChecked: true,
    });
    expect(out.weightDiscrepancy).toBe(true);
    expect(out.shipment.status).toBe(ShipmentStatus.WEIGHT_DISCREPANCY);
  });

  it("requires an explicit cash check (Constraint 2.5)", async () => {
    const s = await newShipment();
    await expect(
      handoff.intake({
        shipmentId: s.id,
        operatorId: OP,
        photoUrls: ["intake.jpg"],
        itemWeights: [{ itemId: s.items[0]!.id, actualWeightKg: 3 }],
        cashChecked: false,
      }),
    ).rejects.toMatchObject({ code: "UNPROCESSABLE" });
  });

  it("requires at least one intake photo", async () => {
    const s = await newShipment();
    await expect(
      handoff.intake({
        shipmentId: s.id,
        operatorId: OP,
        photoUrls: [],
        itemWeights: [{ itemId: s.items[0]!.id, actualWeightKg: 3 }],
        cashChecked: true,
      }),
    ).rejects.toMatchObject({ code: "UNPROCESSABLE" });
  });
});

describe("HandoffService.verify / seal (Constraint 2.2 ordering)", () => {
  async function intake(s: { id: string; items: { id: string }[] }) {
    await handoff.intake({
      shipmentId: s.id,
      operatorId: OP,
      photoUrls: ["intake.jpg"],
      itemWeights: [{ itemId: s.items[0]!.id, actualWeightKg: 3 }],
      cashChecked: true,
    });
  }

  it("cannot reach CONTENTS_VERIFIED without a contents photo", async () => {
    const s = await newShipment();
    await intake(s);
    await expect(
      handoff.verify({ shipmentId: s.id, operatorId: OP, photoUrls: [] }),
    ).rejects.toMatchObject({ code: "UNPROCESSABLE" });
  });

  it("cannot SEAL before verification (sealing never precedes inspection)", async () => {
    const s = await newShipment();
    await intake(s); // now AT_ORIGIN_HUB, not yet verified
    await expect(
      handoff.seal({ shipmentId: s.id, operatorId: OP, sealId: "SEAL-1", photoUrls: ["seal.jpg"] }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it("runs the full chain: intake → verify → seal → AWAITING_MATCH, stamping the seal", async () => {
    const s = await newShipment();
    await intake(s);
    const verified = await handoff.verify({
      shipmentId: s.id,
      operatorId: OP,
      photoUrls: ["contents-1.jpg", "contents-2.jpg"],
    });
    expect(verified.shipment.status).toBe(ShipmentStatus.CONTENTS_VERIFIED);

    const sealed = await handoff.seal({
      shipmentId: s.id,
      operatorId: OP,
      sealId: "SEAL-42",
      photoUrls: ["seal.jpg"],
    });
    expect(sealed.shipment.status).toBe(ShipmentStatus.AWAITING_MATCH);
    expect(sealed.handoff.sealApplied).toBe(true);
    expect(sealed.shipment.items.every((i) => i.sealId === "SEAL-42")).toBe(true);

    const chain = await handoff.listForShipment(s.id);
    expect(chain).toHaveLength(3); // intake, verify, seal
  });
});
