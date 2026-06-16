import { type NextRequest } from "next/server";
import { handle, ok } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { Prisma, NotificationStatus } from "@prisma/client";

function requireCronSecret(req: NextRequest): void {
  const auth = req.headers.get("Authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    throw ApiError.forbidden("Invalid cron secret.");
  }
}

const HELD_TIMEOUT_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000;      // don't re-alert within 24h

export function GET(req: NextRequest) {
  return handle(async () => {
    requireCronSecret(req);

    const cutoff = new Date(Date.now() - HELD_TIMEOUT_MS);
    const dedupCutoff = new Date(Date.now() - DEDUP_WINDOW_MS);

    const timedOut = await prisma.escrowRecord.findMany({
      where: {
        status: "HELD",
        heldAt: { lt: cutoff },
      },
      select: { id: true, shipmentId: true, heldAt: true },
    });

    let alerted = 0;
    for (const escrow of timedOut) {
      const recent = await prisma.notification.findFirst({
        where: {
          templateKey: "admin_alert_escrow_timeout",
          payload: { path: ["escrowId"], equals: escrow.id },
          createdAt: { gte: dedupCutoff },
          status: { notIn: [NotificationStatus.FAILED] },
        },
      });
      if (recent) continue;

      await prisma.notification.create({
        data: {
          channel: "SMS",
          templateKey: "admin_alert_escrow_timeout",
          payload: { escrowId: escrow.id, shipmentId: escrow.shipmentId, heldAt: escrow.heldAt?.toISOString() ?? null } as Prisma.InputJsonValue,
          language: "EN",
          status: NotificationStatus.QUEUED,
          attempts: 0,
        },
      });
      alerted++;
    }

    return ok({ found: timedOut.length, alerted });
  });
}
