import {
  ShipmentStatus,
  HandoffType,
  CaptureMethod,
  AuditActorType,
  type HandoffRecord,
} from "@prisma/client";
import { assertTransition } from "@/lib/domain/state-machine";
import { ApiError } from "@/lib/api/errors";
import { signDeliveryToken, verifyDeliveryToken } from "@/lib/delivery/token";
import { notificationsForTransition } from "@/lib/domain/notifications";
import type { Repositories, ShipmentWithItems } from "@/lib/db/ports";

export interface DeliveryOptions {
  tokenSecret: string;
  appUrl: string;
}

export interface DeliverOutcome {
  shipment: ShipmentWithItems;
  handoff: HandoffRecord;
  /** The receiver-confirmation token (also embedded in the SMS notification link). */
  token: string;
}

/**
 * DeliveryService — last mile + receiver confirmation (Constraint 2.2 live capture;
 * SMS-first receivers). Delivery photos are LIVE-capture only. On delivery a signed,
 * stateless token is minted and a receiver-SMS notification is queued atomically
 * inside the DELIVERED transition (outbox pattern — drain cron sends it). A disputed
 * delivery NEVER releases escrow — the hold stays put.
 */
export class DeliveryService {
  constructor(
    private readonly repos: Repositories,
    private readonly opts: DeliveryOptions,
  ) {}

  /** Aggregator dispatches for last-mile: AT_DESTINATION_HUB → OUT_FOR_DELIVERY. */
  async outForDelivery(
    shipmentId: string,
    operatorId: string,
  ): Promise<ShipmentWithItems> {
    const shipment = await this.requireShipment(shipmentId);
    return this.transition(
      shipment,
      ShipmentStatus.OUT_FOR_DELIVERY,
      operatorId,
      "out for delivery",
    );
  }

  /** Courier marks a failed attempt: OUT_FOR_DELIVERY → DELIVERY_ATTEMPTED. */
  async attempted(
    shipmentId: string,
    courierId: string,
  ): Promise<ShipmentWithItems> {
    const shipment = await this.requireShipment(shipmentId);
    return this.transition(
      shipment,
      ShipmentStatus.DELIVERY_ATTEMPTED,
      courierId,
      "delivery attempted",
    );
  }

  /**
   * Courier delivers: OUT_FOR_DELIVERY → DELIVERED with a LIVE photo, then issues a
   * signed confirmation token and SMSs the receiver a no-login confirm link.
   */
  async deliver(input: {
    shipmentId: string;
    courierId: string;
    photoUrls: string[];
    captureMethod: CaptureMethod;
    geoLat?: number;
    geoLng?: number;
  }): Promise<DeliverOutcome> {
    const shipment = await this.requireShipment(input.shipmentId);
    if (input.captureMethod !== CaptureMethod.LIVE) {
      throw ApiError.unprocessable(
        "Delivery photos must be live-captured — gallery uploads are not allowed (Constraint 2.2).",
      );
    }
    if (input.photoUrls.length < 1) {
      throw ApiError.unprocessable("A live delivery photo is required.");
    }
    assertTransition(shipment.status, ShipmentStatus.DELIVERED, { hasHandoff: true });

    const token = signDeliveryToken(shipment.id, this.opts.tokenSecret);
    const link = `${this.opts.appUrl}/confirm?token=${encodeURIComponent(token)}`;

    const notifications = notificationsForTransition(ShipmentStatus.DELIVERED, {
      shipmentId: shipment.id,
      receiverPhone: shipment.receiverPhone,
      confirmLink: link,
    });

    const recorded = await this.repos.handoffs.record({
      shipmentId: shipment.id,
      handoffType: HandoffType.TRAVELER_TO_RECEIVER,
      fromActorId: input.courierId,
      toActorId: shipment.receiverUserId ?? input.courierId,
      photoUrls: input.photoUrls,
      captureMethod: CaptureMethod.LIVE,
      ...(input.geoLat != null ? { geoLat: input.geoLat } : {}),
      ...(input.geoLng != null ? { geoLng: input.geoLng } : {}),
      capturedAt: new Date(),
      expectedVersion: shipment.version,
      toStatus: ShipmentStatus.DELIVERED,
      actorType: AuditActorType.USER,
      actorId: input.courierId,
      reason: "delivered to receiver",
      notifications,
    });
    if (!recorded.ok) {
      throw recorded.reason === "NOT_FOUND"
        ? ApiError.notFound("Shipment not found.")
        : ApiError.conflict("Shipment was modified concurrently; reload and retry.");
    }

    return { shipment: recorded.shipment, handoff: recorded.handoff, token };
  }

  /**
   * Receiver confirms via the SMS token (no login). `problem: true` routes to DISPUTED
   * (broken seal / wrong item) and the escrow hold is left untouched; otherwise
   * DELIVERED → DELIVERY_CONFIRMED (the prior live delivery handoff satisfies the guard).
   */
  async confirmByToken(input: {
    token: string;
    problem: boolean;
    reason?: string;
  }): Promise<{ shipment: ShipmentWithItems; outcome: "DELIVERY_CONFIRMED" | "DISPUTED" }> {
    const verified = verifyDeliveryToken(input.token, this.opts.tokenSecret);
    if (!verified.ok) {
      throw ApiError.unauthorized("This confirmation link is invalid or has expired.");
    }
    const shipment = await this.repos.shipments.findById(verified.shipmentId);
    if (!shipment) throw ApiError.notFound("Shipment not found.");

    if (input.problem) {
      // Escrow stays HELD — a dispute must never release funds (Constraint 2.5 / 2.2).
      const to = ShipmentStatus.DISPUTED;
      assertTransition(shipment.status, to, {});
      const res = await this.repos.shipments.applyTransition({
        shipmentId: shipment.id,
        expectedVersion: shipment.version,
        toStatus: to,
        actorType: AuditActorType.SYSTEM,
        reason: input.reason
          ? `receiver dispute via SMS token: ${input.reason}`
          : "receiver reported a problem (SMS token)",
      });
      if (!res.ok) throw this.conflictOrNotFound(res.reason);
      return { shipment: res.shipment, outcome: "DISPUTED" };
    }

    // Confirm: the courier's live delivery handoff satisfies requiresHandoff.
    const handoffs = await this.repos.handoffs.listByShipment(shipment.id);
    const hasDeliveryHandoff = handoffs.some(
      (h) => h.handoffType === HandoffType.TRAVELER_TO_RECEIVER,
    );
    assertTransition(shipment.status, ShipmentStatus.DELIVERY_CONFIRMED, {
      hasHandoff: hasDeliveryHandoff,
    });
    const res = await this.repos.shipments.applyTransition({
      shipmentId: shipment.id,
      expectedVersion: shipment.version,
      toStatus: ShipmentStatus.DELIVERY_CONFIRMED,
      actorType: AuditActorType.SYSTEM,
      reason: "receiver confirmed delivery (SMS token verified)",
    });
    if (!res.ok) throw this.conflictOrNotFound(res.reason);
    return { shipment: res.shipment, outcome: "DELIVERY_CONFIRMED" };
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private async requireShipment(id: string): Promise<ShipmentWithItems> {
    const shipment = await this.repos.shipments.findById(id);
    if (!shipment) throw ApiError.notFound("Shipment not found.");
    return shipment;
  }

  private async transition(
    shipment: ShipmentWithItems,
    to: ShipmentStatus,
    actorId: string,
    reason: string,
  ): Promise<ShipmentWithItems> {
    assertTransition(shipment.status, to, {});
    const res = await this.repos.shipments.applyTransition({
      shipmentId: shipment.id,
      expectedVersion: shipment.version,
      toStatus: to,
      actorType: AuditActorType.USER,
      actorId,
      reason,
    });
    if (!res.ok) throw this.conflictOrNotFound(res.reason);
    return res.shipment;
  }

  private conflictOrNotFound(reason: "VERSION_CONFLICT" | "NOT_FOUND"): ApiError {
    return reason === "NOT_FOUND"
      ? ApiError.notFound("Shipment not found.")
      : ApiError.conflict("Shipment was modified concurrently; reload and retry.");
  }
}
