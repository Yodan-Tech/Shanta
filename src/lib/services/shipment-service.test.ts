import { describe, it, expect, beforeEach } from "vitest";
import {
  ShipmentStatus,
  RestrictionDirection,
  AuditActorType,
  EscrowStatus,
} from "@prisma/client";
import type { RuleInput, PricingRule } from "@/lib/domain/types";
import { DomainError } from "@/lib/domain/types";
import { ApiError } from "@/lib/api/errors";
import { makeInMemoryRepositories } from "@/lib/db/memory";
import { ShipmentService, type CreateShipmentInput } from "./shipment-service";

const RULES: RuleInput[] = [
  {
    id: "cash",
    itemCategory: "CASH",
    corridorCode: null,
    maxWeightKg: null,
    maxValueEtb: null,
    frequencySensitive: false,
    maxWeightKgFrequent: null,
    requiresDeclaration: false,
    requiresSpecialPermit: false,
    prohibited: true,
    direction: RestrictionDirection.BOTH,
    effectiveFrom: new Date("2026-01-01"),
    effectiveUntil: null,
  },
];

const PRICING: PricingRule = {
  ratePerKgEtb: 120,
  minChargeEtb: 200,
  aggregatorFlatFeeEtb: 50,
  platformCommissionRate: 0.15,
  insuranceRate: 0.02,
  taxRate: 0,
};

function baseInput(over: Partial<CreateShipmentInput> = {}): CreateShipmentInput {
  return {
    senderId: "sender-1",
    receiverName: "Almaz",
    receiverPhone: "+251911223344",
    originRegion: "Addis Ababa",
    destinationRegion: "Hawassa",
    countryCode: "ET",
    insuranceOptedIn: false,
    items: [{ category: "CLOTHING", description: "shirts", declaredWeightKg: 3 }],
    ...over,
  };
}

let repos: ReturnType<typeof makeInMemoryRepositories>;
let svc: ShipmentService;

beforeEach(() => {
  repos = makeInMemoryRepositories({ rules: RULES, pricing: PRICING });
  svc = new ShipmentService(repos);
});

describe("ShipmentService.create", () => {
  it("creates a priced shipment, arms a PENDING escrow, and advances to AWAITING_HUB_INTAKE", async () => {
    const { shipment, price } = await svc.create(baseInput());
    // Create now closes the gap: shipment is armed and awaiting hub intake.
    expect(shipment.status).toBe(ShipmentStatus.AWAITING_HUB_INTAKE);
    expect(shipment.version).toBe(1);
    expect(shipment.items).toHaveLength(1);
    expect(price.carrierFeeEtb).toBe(360);
    expect(price.totalPriceEtb).toBe(471.5);
    // Escrow armed PENDING for exactly the quoted total (matches pricing snapshot).
    const escrow = await repos.escrows.findByShipmentId(shipment.id);
    expect(escrow?.status).toBe(EscrowStatus.PENDING);
    expect(escrow?.holderType).toBe("HUB");
    expect(Number(escrow?.amountEtb)).toBe(471.5);
    // History records both legs of the atomic create+arm.
    expect(repos.shipments.statusHistory.map((h) => h.toStatus)).toEqual([
      ShipmentStatus.RULES_VALIDATED,
      ShipmentStatus.AWAITING_HUB_INTAKE,
    ]);
  });

  it("blocks a shipment containing a prohibited item (cash)", async () => {
    const input = baseInput({
      items: [{ category: "CASH", description: "envelope", declaredWeightKg: 0.1 }],
    });
    await expect(svc.create(input)).rejects.toBeInstanceOf(ApiError);
    await expect(svc.create(input)).rejects.toMatchObject({ code: "RULES_FAILED" });
  });

  it("is idempotent for a repeated idempotency key", async () => {
    const key = crypto.randomUUID();
    const first = await svc.create(baseInput({ idempotencyKey: key }));
    const second = await svc.create(baseInput({ idempotencyKey: key }));
    expect(second.shipment.id).toBe(first.shipment.id);
    expect(repos.shipments.shipments.size).toBe(1);
  });

  it("fails when no corridor pricing is configured", async () => {
    const noPricing = makeInMemoryRepositories({ rules: RULES, pricing: null });
    const s = new ShipmentService(noPricing);
    await expect(s.create(baseInput())).rejects.toMatchObject({
      code: "UNPROCESSABLE",
    });
  });
});

describe("ShipmentService.getForSender / listForSender", () => {
  it("returns an owned shipment and hides others", async () => {
    const { shipment } = await svc.create(baseInput());
    await expect(svc.getForSender(shipment.id, "sender-1")).resolves.toMatchObject({
      id: shipment.id,
    });
    await expect(svc.getForSender(shipment.id, "intruder")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("lists a sender's shipments", async () => {
    await svc.create(baseInput());
    await svc.create(baseInput());
    expect(await svc.listForSender("sender-1")).toHaveLength(2);
  });
});

describe("ShipmentService.transition", () => {
  async function newShipmentId() {
    const { shipment } = await svc.create(baseInput());
    return shipment.id;
  }

  it("applies a legal transition and bumps the version", async () => {
    // After create the shipment is AWAITING_HUB_INTAKE at version 1.
    const id = await newShipmentId();
    const updated = await svc.transition({
      shipmentId: id,
      expectedVersion: 1,
      toStatus: ShipmentStatus.AT_ORIGIN_HUB,
      actorType: AuditActorType.SYSTEM,
      context: { hasHandoff: true },
    });
    expect(updated.status).toBe(ShipmentStatus.AT_ORIGIN_HUB);
    expect(updated.version).toBe(2);
  });

  it("rejects an illegal transition", async () => {
    const id = await newShipmentId();
    await expect(
      svc.transition({
        shipmentId: id,
        expectedVersion: 1,
        toStatus: ShipmentStatus.DELIVERED,
        actorType: AuditActorType.SYSTEM,
      }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it("returns 409 CONFLICT on a version mismatch", async () => {
    const id = await newShipmentId();
    await expect(
      svc.transition({
        shipmentId: id,
        expectedVersion: 99,
        toStatus: ShipmentStatus.AT_ORIGIN_HUB,
        actorType: AuditActorType.SYSTEM,
        context: { hasHandoff: true },
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("enforces the verification-photo guard (Constraint 2.2)", async () => {
    const id = await newShipmentId();
    let v = 1; // AWAITING_HUB_INTAKE after create+arm
    const step = async (to: ShipmentStatus, context = {}) => {
      const s = await svc.transition({
        shipmentId: id,
        expectedVersion: v,
        toStatus: to,
        actorType: AuditActorType.USER,
        context,
      });
      v = s.version;
    };
    await step(ShipmentStatus.AT_ORIGIN_HUB, { hasHandoff: true });
    // CONTENTS_VERIFIED requires a contents photo — missing → guard throws.
    await expect(
      svc.transition({
        shipmentId: id,
        expectedVersion: v,
        toStatus: ShipmentStatus.CONTENTS_VERIFIED,
        actorType: AuditActorType.USER,
        context: {},
      }),
    ).rejects.toBeInstanceOf(DomainError);
    // With the photo it succeeds.
    await expect(
      svc.transition({
        shipmentId: id,
        expectedVersion: v,
        toStatus: ShipmentStatus.CONTENTS_VERIFIED,
        actorType: AuditActorType.USER,
        context: { hasVerificationPhoto: true },
      }),
    ).resolves.toMatchObject({ status: ShipmentStatus.CONTENTS_VERIFIED });
  });
});
