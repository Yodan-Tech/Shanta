import { type NextRequest } from "next/server";
import { handle, ok } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { Prisma, NotificationStatus } from "@prisma/client";
import { getRepositories } from "@/lib/db/prisma-repositories";
import { NotificationService } from "@/lib/services/notification-service";
import { getSmsSender } from "@/lib/sms/sender";

function requireCronSecret(req: NextRequest): void {
  const auth = req.headers.get("Authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    throw ApiError.forbidden("Invalid cron secret.");
  }
}

const TERMINAL_STATUSES = [
  "COMPLETED",
  "CANCELLED",
  "RETURNED_TO_SENDER",
  "ESCROW_RELEASED",
  "ESCROW_REFUNDED",
];

const STUCK_THRESHOLD_MS = 48 * 60 * 60 * 1000; // 48 hours
const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000;    // don't re-alert within 24h

export function GET(req: NextRequest) {
  return handle(async () => {
    requireCronSecret(req);

    const cutoff = new Date(Date.now() - STUCK_THRESHOLD_MS);
    const dedupCutoff = new Date(Date.now() - DEDUP_WINDOW_MS);

    const stuck = await prisma.shipment.findMany({
      where: {
        status: { notIn: TERMINAL_STATUSES as never[] },
        updatedAt: { lt: cutoff },
        deletedAt: null,
      },
      select: { id: true, status: true },
    });

    const repos = getRepositories();
    let alerted = 0;

    for (const shipment of stuck) {
      // Idempotency: skip if an admin alert was already queued in the last 24h.
      const recent = await prisma.notification.findFirst({
        where: {
          templateKey: "admin_alert_stuck_shipment",
          payload: { path: ["shipmentId"], equals: shipment.id },
          createdAt: { gte: dedupCutoff },
          status: { notIn: [NotificationStatus.FAILED] },
        },
      });
      if (recent) continue;

      await prisma.notification.create({
        data: {
          channel: "SMS",
          templateKey: "admin_alert_stuck_shipment",
          payload: { shipmentId: shipment.id, status: shipment.status } as Prisma.InputJsonValue,
          language: "EN",
          status: NotificationStatus.QUEUED,
          attempts: 0,
        },
      });
      alerted++;
    }

    // Immediately drain admin alerts (so they go out in this run if an admin phone is configured).
    const svc = new NotificationService(repos, getSmsSender());
    const drain = await svc.drainOutbox(10);

    return ok({ found: stuck.length, alerted, drain });
  });
}
