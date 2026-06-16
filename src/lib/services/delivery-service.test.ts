import { describe, it, expect, beforeEach } from "vitest";
import { ShipmentStatus, CaptureMethod, EscrowStatus, AuditActorType } from "@prisma/client";
import type { PricingRule } from "@/lib/domain/types";
import { makeInMemoryRepositories } from "@/lib/db/memory";
import { LoggingSmsSender } from "@/lib/sms/sender";
import { ShipmentService, type CreateShipmentInput } from "./shipment-service";
import { EscrowService } from "./escrow-service";
import { DeliveryService } from "./delivery-service";

const PRICING: PricingRule = {
  ratePerKgEtb: 120, minChargeEtb: 200, aggregatorFlatFeeEtb: 50,
  platformCommissionRate: 0.15, insuranceRate: 0.02, taxRate: 0,
};
const SECRET = "delivery-secret";
const COURIER = "courier-1";

function baseInput(over: Partial<CreateShipmentInput> = {}): CreateShipmentInput {
  return {
    senderId: "sender-1", receiverName: "Almaz", receiverPhone: "+251911223344",
    originRegion: "Addis Ababa", destinationRegion: "Hawassa", countryCode: "ET",
    insuranceOptedIn: false,
    items: [{ category: "CLOTHING", description: "shirts", declaredWeightKg: 3 }],
    ...over,
  };
}

let repos: ReturnType<typeof makeInMemoryRepositories>;
let ship: ShipmentService;
let escrow: EscrowService;
let sms: LoggingSmsSender;
let delivery: DeliveryService;

beforeEach(() => {
  repos = makeInMemoryRepositories({ rules: [], pricing: PRICING });
  ship = new ShipmentService(repos);
  escrow = new EscrowService(repos);
  sms = new LoggingSmsSender();
  delivery = new DeliveryService(repos, sms, { tokenSecret: SECRET, appUrl: "https://shanta.app" });
});

/** Drive a fresh shipment to OUT_FOR_DELIVERY using guarded transitions. */
async function outForDelivery() {
  const { shipment } = await ship.create(baseInput());
  const id = shipment.id;
  let v = 1;
  const step = async (to: ShipmentStatus, context = {}) => {
    const s = await ship.transition({ shipmentId: id, expectedVersion: v, toStatus: to, actorType: AuditActorType.USER, context });
    v = s.version;
  };
  await step(ShipmentStatus.AT_ORIGIN_HUB, { hasHandoff: true });
  await step(ShipmentStatus.CONTENTS_VERIFIED, { hasVerificationPhoto: true });
  await step(ShipmentStatus.SEALED, { sealApplied: true });
  await step(ShipmentStatus.AWAITING_MATCH);
  await step(ShipmentStatus.MATCHED_TO_TRAVELER);
  await step(ShipmentStatus.TRAVELER_REVIEWED, { hasHandoff: true });
  await step(ShipmentStatus.TRAVELER_ACCEPTED, { acknowledged: true });
  await step(ShipmentStatus.WITH_TRAVELER);
  await escrow.markHeld(id); // custody → escrow HELD
  await step(ShipmentStatus.IN_TRANSIT);
  await step(ShipmentStatus.AT_DESTINATION_HUB, { hasHandoff: true });
  await step(ShipmentStatus.OUT_FOR_DELIVERY);
  return id;
}

describe("DeliveryService.deliver (Constraint 2.2 live capture)", () => {
  it("delivers with a live photo, issues a token, and SMSs the receiver", async () => {
    const id = await outForDelivery();
    const out = await delivery.deliver({ shipmentId: id, courierId: COURIER, photoUrls: ["live.jpg"], captureMethod: CaptureMethod.LIVE });
    expect(out.shipment.status).toBe(ShipmentStatus.DELIVERED);
    expect(out.token).toBeTruthy();
    expect(sms.sent).toHaveLength(1);
    expect(sms.sent[0]!.to).toBe("+251911223344");
    expect(sms.sent[0]!.body).toContain("token=");
  });

  it("rejects a gallery (non-live) delivery photo", async () => {
    const id = await outForDelivery();
    await expect(
      delivery.deliver({ shipmentId: id, courierId: COURIER, photoUrls: ["g.jpg"], captureMethod: CaptureMethod.GALLERY }),
    ).rejects.toMatchObject({ code: "UNPROCESSABLE" });
  });
});

describe("DeliveryService.confirmByToken (SMS-first receiver)", () => {
  async function delivered() {
    const id = await outForDelivery();
    const { token } = await delivery.deliver({ shipmentId: id, courierId: COURIER, photoUrls: ["live.jpg"], captureMethod: CaptureMethod.LIVE });
    return { id, token };
  }

  it("confirms a clean delivery → DELIVERY_CONFIRMED", async () => {
    const { token } = await delivered();
    const out = await delivery.confirmByToken({ token, problem: false });
    expect(out.outcome).toBe("DELIVERY_CONFIRMED");
    expect(out.shipment.status).toBe(ShipmentStatus.DELIVERY_CONFIRMED);
  });

  it("a disputed delivery goes to DISPUTED and NEVER releases escrow", async () => {
    const { id, token } = await delivered();
    const out = await delivery.confirmByToken({ token, problem: true, reason: "broken seal" });
    expect(out.outcome).toBe("DISPUTED");
    expect(out.shipment.status).toBe(ShipmentStatus.DISPUTED);
    // Escrow remains HELD — the hold must survive a dispute.
    expect((await repos.escrows.findByShipmentId(id))!.status).toBe(EscrowStatus.HELD);
  });

  it("rejects an invalid / expired token", async () => {
    await delivered();
    await expect(
      delivery.confirmByToken({ token: "tampered.token", problem: false }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
