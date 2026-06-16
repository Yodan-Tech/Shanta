import type { SmsSender } from "@/lib/sms/sender";
import { renderSmsTemplate } from "@/lib/sms/templates";
import type { Repositories } from "@/lib/db/ports";

const MAX_ATTEMPTS = 3;

export interface DrainResult {
  sent: number;
  failed: number;
  skipped: number;
}

/**
 * NotificationService — drains the outbox and sends SMS. Each notification row
 * was written atomically inside the same DB transaction as the shipment transition
 * that triggered it (via txTransitionShipment). This service runs on a Vercel Cron
 * schedule (every minute) and retries up to MAX_ATTEMPTS times.
 */
export class NotificationService {
  constructor(
    private readonly repos: Repositories,
    private readonly sms: SmsSender,
  ) {}

  async drainOutbox(limit = 50): Promise<DrainResult> {
    const rows = await this.repos.notifications.drainQueued(limit);
    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const row of rows) {
      // Snapshot attempts BEFORE any mutation (in-memory fake returns references).
      const attemptsNow = row.attempts;

      // Resolve recipient phone: either stored directly or looked up from profile.
      let phone = row.recipientPhone;
      if (!phone && row.userId) {
        phone = await this.repos.profiles.getPhone(row.userId);
      }
      if (!phone) {
        // No phone resolvable — increment and mark so it doesn't loop forever.
        await this.repos.notifications.incrementAttempts(row.id);
        if (attemptsNow + 1 >= MAX_ATTEMPTS) {
          await this.repos.notifications.markFailed(row.id);
          failed++;
        } else {
          await this.repos.notifications.markRetrying(row.id);
          skipped++;
        }
        continue;
      }

      await this.repos.notifications.incrementAttempts(row.id);
      const body = renderSmsTemplate(
        row.templateKey,
        row.payload as Record<string, unknown>,
        row.language,
      );

      try {
        const result = await this.sms.send({ to: phone, body });
        await this.repos.notifications.markSent(row.id, result.providerRef);
        sent++;
      } catch {
        if (attemptsNow + 1 >= MAX_ATTEMPTS) {
          await this.repos.notifications.markFailed(row.id);
          failed++;
        } else {
          await this.repos.notifications.markRetrying(row.id);
        }
      }
    }

    return { sent, failed, skipped };
  }
}
