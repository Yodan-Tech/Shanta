import { describe, it, expect, beforeEach, vi } from "vitest";
import { ShipmentStatus, CaptureMethod, AuditActorType } from "@prisma/client";
import type { PricingRule } from "@/lib/domain/types";
import { makeInMemoryRepositories } from "@/lib/db/memory";
import { LoggingSmsSender } from "@/lib/sms/sender";
import { ShipmentService, type CreateShipmentInput } from "./shipment-service";
import { EscrowService } from "./escrow-service";
import { DeliveryService } from "./delivery-service";
import { NotificationService } from "./notification-service";

const PRICING: PricingRule = {
  ratePerKgEtb: 120, minChargeEtb: 200, aggregatorFlatFeeEtb: 50,
  platformCommissionRate: 0.15, insuranceRate: 0.02, taxRate: 0,
};
const SECRET = "test-secret";
const COURIER = "courier-1";
const SENDER_ID = "sender-uuid-1";
const SENDER_PHONE = "+251911000001";
const RECEIVER_PHONE = "+251922000002";

function shipmentInput(): CreateShipmentInput {
  return {
    senderId: SENDER_ID,
    receiverName: "Almaz",
    receiverPhone: RECEIVER_PHONE,
    originRegion: "Addis Ababa",
    destinationRegion: "Hawassa",
    countryCode: "ET",
    insuranceOptedIn: false,
    items: [{ category: "CLOTHING", description: "shirts", declaredWeightKg: 3 }],
  };
}

let repos: ReturnType<typeof makeInMemoryRepositories>;
let ship: ShipmentService;
let delivery: DeliveryService;
let sms: LoggingSmsSender;
let svc: NotificationService;

beforeEach(() => {
  repos = makeInMemoryRepositories({
    rules: [],
    pricing: PRICING,
    phones: { [SENDER_ID]: SENDER_PHONE },
  });
  ship = new ShipmentService(repos);
  delivery = new DeliveryService(repos, { tokenSecret: SECRET, appUrl: "https://shanta.app" });
  sms = new LoggingSmsSender();
  svc = new NotificationService(repos, sms);
});

/** Drive a shipment to DELIVERED using the real service stack. */
async function driveToDelivered() {
  const { shipment } = await ship.create(shipmentInput());
  const id = shipment.id;
  let v = 1; // after armEscrow, version = 1
  const step = async (to: ShipmentStatus, ctx = {}) => {
    const s = await ship.transition({ shipmentId: id, expectedVersion: v, toStatus: to, actorType: AuditActorType.USER, context: ctx });
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
  await new EscrowService(repos).markHeld(id);
  await step(ShipmentStatus.IN_TRANSIT);
  await step(ShipmentStatus.AT_DESTINATION_HUB, { hasHandoff: true });
  await step(ShipmentStatus.OUT_FOR_DELIVERY);
  const { token } = await delivery.deliver({ shipmentId: id, courierId: COURIER, photoUrls: ["live.jpg"], captureMethod: CaptureMethod.LIVE });
  return { id, token };
}

describe("Notification outbox — written in same transaction as transition", () => {
  it("queues a receiver SMS notification atomically when DELIVERED is transitioned", async () => {
    await driveToDelivered();
    const notifs = repos.notifications.notifications;
    expect(notifs.length).toBeGreaterThan(0);
    const deliveryNotif = notifs.find((n) => n.templateKey === "delivery_confirmation_link");
    expect(deliveryNotif).toBeDefined();
    expect(deliveryNotif!.recipientPhone).toBe(RECEIVER_PHONE);
    expect(deliveryNotif!.status).toBe("QUEUED");
    const payload = deliveryNotif!.payload as Record<string, unknown>;
    expect(payload["confirmLink"]).toContain("token=");
  });

  it("queues a shipment_created notification when shipment is created", async () => {
    await ship.create(shipmentInput());
    const notifs = repos.notifications.notifications;
    const created = notifs.find((n) => n.templateKey === "shipment_created");
    expect(created).toBeDefined();
    expect(created!.userId).toBe(SENDER_ID);
    expect(created!.status).toBe("QUEUED");
  });
});

describe("NotificationService.drainOutbox", () => {
  it("sends queued notifications and marks them SENT", async () => {
    await driveToDelivered();
    const before = repos.notifications.notifications.filter((n) => n.status === "QUEUED").length;
    expect(before).toBeGreaterThan(0);

    const result = await svc.drainOutbox(100);
    expect(result.sent + result.failed + result.skipped).toBeLessThanOrEqual(before);

    // The delivery_confirmation_link should be sent (receiver phone is known directly).
    expect(sms.sent.some((m) => m.to === RECEIVER_PHONE)).toBe(true);

    // After draining, no rows remain QUEUED.
    const stillQueued = repos.notifications.notifications.filter((n) => n.status === "QUEUED");
    expect(stillQueued).toHaveLength(0);
  });

  it("resolves sender phone via ProfileRepository and sends sender notifications", async () => {
    await ship.create(shipmentInput());
    await svc.drainOutbox(10);
    expect(sms.sent.some((m) => m.to === SENDER_PHONE)).toBe(true);
  });

  it("marks RETRYING after one failure, FAILED after max attempts", async () => {
    const failingSms = {
      sent: [] as { to: string; body: string }[],
      send: vi.fn().mockRejectedValue(new Error("provider down")),
    };
    const failSvc = new NotificationService(repos, failingSms);

    // Seed one notification row directly.
    repos.notifications.writeSpecs([{
      recipientPhone: RECEIVER_PHONE,
      channel: "SMS",
      templateKey: "delivery_confirmation_link",
      payload: { shipmentId: "s1", confirmLink: "https://x.com/confirm?token=abc" },
      language: "EN",
    }]);

    // First drain: attempts 0→1, status → RETRYING (attempts < 3).
    await failSvc.drainOutbox(10);
    let n = repos.notifications.notifications[0]!;
    expect(n.status).toBe("RETRYING");
    expect(n.attempts).toBe(1);

    // Second drain: attempts 1→2, still RETRYING.
    await failSvc.drainOutbox(10);
    n = repos.notifications.notifications[0]!;
    expect(n.status).toBe("RETRYING");
    expect(n.attempts).toBe(2);

    // Third drain: attempts 2→3, → FAILED (MAX_ATTEMPTS reached).
    await failSvc.drainOutbox(10);
    n = repos.notifications.notifications[0]!;
    expect(n.status).toBe("FAILED");
    expect(n.attempts).toBe(3);
  });

  it("drainOutbox is idempotent — running on already-SENT rows has no effect", async () => {
    repos.notifications.writeSpecs([{
      recipientPhone: RECEIVER_PHONE,
      channel: "SMS",
      templateKey: "shipment_created",
      payload: { shipmentId: "s1" },
      language: "EN",
    }]);

    await svc.drainOutbox(10);
    expect(sms.sent).toHaveLength(1);

    // Second call — no QUEUED rows remain; SMS count stays at 1.
    await svc.drainOutbox(10);
    expect(sms.sent).toHaveLength(1);
  });
});
