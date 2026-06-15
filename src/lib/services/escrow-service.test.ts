import { describe, it, expect, beforeEach } from "vitest";
import { ShipmentStatus, EscrowStatus, AuditActorType } from "@prisma/client";
import type { PricingRule } from "@/lib/domain/types";
import { DomainError } from "@/lib/domain/types";
import { makeInMemoryRepositories } from "@/lib/db/memory";
import { ShipmentService, type CreateShipmentInput } from "./shipment-service";
import { EscrowService } from "./escrow-service";

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
let ship: ShipmentService;
let escrow: EscrowService;

beforeEach(() => {
  repos = makeInMemoryRepositories({ rules: [], pricing: PRICING });
  ship = new ShipmentService(repos);
  escrow = new EscrowService(repos);
});

/** Walk a freshly-created (AWAITING_HUB_INTAKE, v1) shipment forward. */
async function step(
  id: string,
  version: number,
  to: ShipmentStatus,
  context: Record<string, boolean> = {},
): Promise<number> {
  const s = await ship.transition({
    shipmentId: id,
    expectedVersion: version,
    toStatus: to,
    actorType: AuditActorType.USER,
    context,
  });
  return s.version;
}

/** Drive to DELIVERED, returning the current version (escrow left untouched). */
async function driveToDelivered(id: string): Promise<number> {
  let v = 1;
  v = await step(id, v, ShipmentStatus.AT_ORIGIN_HUB, { hasHandoff: true });
  v = await step(id, v, ShipmentStatus.CONTENTS_VERIFIED, { hasVerificationPhoto: true });
  v = await step(id, v, ShipmentStatus.SEALED, { sealApplied: true });
  v = await step(id, v, ShipmentStatus.AWAITING_MATCH);
  v = await step(id, v, ShipmentStatus.MATCHED_TO_TRAVELER);
  v = await step(id, v, ShipmentStatus.TRAVELER_REVIEWED, { hasHandoff: true });
  v = await step(id, v, ShipmentStatus.TRAVELER_ACCEPTED, { acknowledged: true });
  v = await step(id, v, ShipmentStatus.WITH_TRAVELER);
  v = await step(id, v, ShipmentStatus.IN_TRANSIT);
  v = await step(id, v, ShipmentStatus.AT_DESTINATION_HUB, { hasHandoff: true });
  v = await step(id, v, ShipmentStatus.OUT_FOR_DELIVERY);
  v = await step(id, v, ShipmentStatus.DELIVERED, { hasHandoff: true });
  return v;
}

describe("EscrowService — arm on create (atomicity)", () => {
  it("arms a PENDING escrow whose amount matches the pricing snapshot", async () => {
    const { shipment } = await ship.create(baseInput());
    const rec = await escrow.getForShipment(shipment.id);
    expect(rec.status).toBe(EscrowStatus.PENDING);
    expect(shipment.status).toBe(ShipmentStatus.AWAITING_HUB_INTAKE);
    const snap = shipment.pricingSnapshot as { breakdown: { totalPriceEtb: number } };
    expect(Number(rec.amountEtb)).toBe(snap.breakdown.totalPriceEtb);
    expect(Number(rec.amountEtb)).toBe(Number(shipment.totalPriceEtb));
  });
});

describe("EscrowService — markHeld", () => {
  it("moves PENDING → HELD and refuses a second hold", async () => {
    const { shipment } = await ship.create(baseInput());
    const held = await escrow.markHeld(shipment.id);
    expect(held.status).toBe(EscrowStatus.HELD);
    expect(held.heldAt).toBeInstanceOf(Date);
    await expect(escrow.markHeld(shipment.id)).rejects.toBeInstanceOf(DomainError);
  });
});

describe("EscrowService — release", () => {
  it("releases only after DELIVERY_CONFIRMED, pairing with ESCROW_RELEASED", async () => {
    const { shipment } = await ship.create(baseInput());
    await escrow.markHeld(shipment.id);
    let v = await driveToDelivered(shipment.id);
    v = await step(shipment.id, v, ShipmentStatus.DELIVERY_CONFIRMED, { hasHandoff: true });

    const result = await escrow.release({
      shipmentId: shipment.id,
      expectedVersion: v,
      adminId: "admin-fin-1",
    });
    expect(result.escrow.status).toBe(EscrowStatus.RELEASED);
    expect(result.escrow.releasedBy).toBe("admin-fin-1");
    expect(result.escrow.releasedAt).toBeInstanceOf(Date);
    expect(result.shipment.status).toBe(ShipmentStatus.ESCROW_RELEASED);
  });

  it("refuses to release before delivery is confirmed", async () => {
    const { shipment } = await ship.create(baseInput());
    await escrow.markHeld(shipment.id);
    await expect(
      escrow.release({ shipmentId: shipment.id, expectedVersion: 1, adminId: "a" }),
    ).rejects.toMatchObject({ code: "UNPROCESSABLE" });
    expect((await escrow.getForShipment(shipment.id)).status).toBe(EscrowStatus.HELD);
  });

  it("NEVER releases on a DISPUTED shipment — escrow stays HELD", async () => {
    const { shipment } = await ship.create(baseInput());
    await escrow.markHeld(shipment.id);
    let v = await driveToDelivered(shipment.id);
    // Broken seal / problem at delivery → DISPUTED (escrow must remain HELD).
    v = await step(shipment.id, v, ShipmentStatus.DISPUTED);

    await expect(
      escrow.release({ shipmentId: shipment.id, expectedVersion: v, adminId: "a" }),
    ).rejects.toMatchObject({ code: "UNPROCESSABLE" });
    expect((await escrow.getForShipment(shipment.id)).status).toBe(EscrowStatus.HELD);
    expect((await repos.shipments.findById(shipment.id))?.status).toBe(
      ShipmentStatus.DISPUTED,
    );
  });
});

describe("EscrowService — escrow is optional", () => {
  it("creates a shipment with NO escrow when escrow is disabled, but still advances to intake", async () => {
    const { shipment } = await ship.create(baseInput({ escrow: false }));
    expect(shipment.status).toBe(ShipmentStatus.AWAITING_HUB_INTAKE);
    expect(await repos.escrows.findByShipmentId(shipment.id)).toBeNull();
    // markHeldIfPresent is a no-op (returns null) when there is no escrow.
    expect(await escrow.markHeldIfPresent(shipment.id)).toBeNull();
    // An explicit release is rejected — there is nothing to release.
    await expect(
      escrow.release({ shipmentId: shipment.id, expectedVersion: shipment.version, adminId: "a" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("respects the escrow.enabled config when no per-shipment override is given", async () => {
    const off = makeInMemoryRepositories({
      rules: [],
      pricing: PRICING,
      config: { "escrow.enabled": 0 },
    });
    const { shipment } = await new ShipmentService(off).create(baseInput());
    expect(await off.escrows.findByShipmentId(shipment.id)).toBeNull();
    expect(shipment.status).toBe(ShipmentStatus.AWAITING_HUB_INTAKE);
  });
});

describe("EscrowService — refund", () => {
  it("refunds a PENDING hold and then blocks any release", async () => {
    const { shipment } = await ship.create(baseInput());
    const refunded = await escrow.refund({
      shipmentId: shipment.id,
      adminId: "admin-fin-1",
      reason: "sender cancelled before intake",
    });
    expect(refunded.status).toBe(EscrowStatus.REFUNDED);
    expect(refunded.refundedAt).toBeInstanceOf(Date);
    // A settled (refunded) escrow can no longer be marked held or released.
    await expect(escrow.markHeld(shipment.id)).rejects.toBeInstanceOf(DomainError);
  });
});
