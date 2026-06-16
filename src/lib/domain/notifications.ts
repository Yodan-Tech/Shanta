import type { ShipmentStatus, NotificationChannel, Language } from "@prisma/client";

/**
 * Context the service layer provides when computing notifications for a transition.
 * Services have the shipment in hand; they extract what's needed here.
 */
export interface NotificationCtx {
  shipmentId: string;
  /** Sender's profile id — used when we don't have their phone directly. */
  senderUserId?: string;
  /** Receiver phone is stored directly on the shipment. */
  receiverPhone?: string;
  /** Pre-built confirmation link for the DELIVERED notification. */
  confirmLink?: string;
  language?: Language;
}

/**
 * A pending notification to persist atomically with the transition.
 * Maps directly to the Notification model's create-time fields.
 */
export interface NotificationSpec {
  /** Profile id — drain worker resolves phone when recipientPhone is null. */
  userId?: string;
  /** Known phone (receiver). Set when we have it directly. */
  recipientPhone?: string;
  channel: NotificationChannel;
  templateKey: string;
  payload: Record<string, unknown>;
  language: Language;
}

const EN: Language = "EN";
const SMS: NotificationChannel = "SMS";

/**
 * Pure function — no I/O. Maps a target shipment status to the notifications
 * that must be written in the same transaction as the transition. Returns an
 * empty array for transitions that need no notification.
 */
export function notificationsForTransition(
  toStatus: ShipmentStatus,
  ctx: NotificationCtx,
): NotificationSpec[] {
  const lang = ctx.language ?? EN;

  /** Notification to sender (phone resolved at drain time via userId). */
  const toSender = (
    templateKey: string,
    payload: Record<string, unknown> = {},
  ): NotificationSpec => ({
    ...(ctx.senderUserId ? { userId: ctx.senderUserId } : {}),
    channel: SMS,
    templateKey,
    payload: { shipmentId: ctx.shipmentId, ...payload },
    language: lang,
  });

  /** Notification to receiver (phone known directly). */
  const toReceiver = (
    templateKey: string,
    payload: Record<string, unknown> = {},
  ): NotificationSpec => ({
    ...(ctx.receiverPhone ? { recipientPhone: ctx.receiverPhone } : {}),
    channel: SMS,
    templateKey,
    payload: { shipmentId: ctx.shipmentId, ...payload },
    language: lang,
  });

  switch (toStatus) {
    case "AWAITING_HUB_INTAKE":
      return ctx.senderUserId ? [toSender("shipment_created")] : [];

    case "AT_ORIGIN_HUB":
      return ctx.senderUserId ? [toSender("shipment_received_hub")] : [];

    case "MATCHED_TO_TRAVELER":
      return ctx.senderUserId ? [toSender("shipment_matched")] : [];

    case "WITH_TRAVELER":
      return ctx.senderUserId ? [toSender("shipment_in_transit")] : [];

    case "TRAVELER_REJECTED":
      return ctx.senderUserId ? [toSender("shipment_requeued")] : [];

    case "DELIVERED":
      if (!ctx.receiverPhone) return [];
      return [
        toReceiver("delivery_confirmation_link", {
          confirmLink: ctx.confirmLink ?? "",
        }),
      ];

    case "DELIVERY_CONFIRMED":
      return ctx.senderUserId ? [toSender("delivery_confirmed")] : [];

    case "DISPUTED":
      return ctx.senderUserId ? [toSender("shipment_disputed")] : [];

    case "CANCELLED":
      return ctx.senderUserId ? [toSender("shipment_cancelled")] : [];

    case "RETURNED_TO_SENDER":
      return ctx.senderUserId ? [toSender("shipment_returned")] : [];

    default:
      return [];
  }
}
