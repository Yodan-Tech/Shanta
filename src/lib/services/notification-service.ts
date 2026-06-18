import type { SmsSender } from "@/lib/sms/sender";
import {
  LoggingTelegramSender,
  type TelegramSender,
} from "@/lib/telegram/sender";
import { renderSmsTemplate } from "@/lib/sms/templates";
import type { Repositories } from "@/lib/db/ports";

const MAX_ATTEMPTS = 3;

export interface DrainResult {
  sent: number;
  failed: number;
  skipped: number;
}

/**
 * NotificationService — drains the outbox and delivers each message. Rows are
 * written atomically inside the same DB transaction as the shipment transition
 * that triggered them. Delivery is channel-resolved at drain time: a recipient
 * with a linked Telegram account is reached over Telegram (free); otherwise SMS.
 * Receivers (phone only, no userId) always go SMS. Runs on a Vercel Cron schedule
 * and retries up to MAX_ATTEMPTS times.
 */
export class NotificationService {
  private readonly telegram: TelegramSender;

  constructor(
    private readonly repos: Repositories,
    private readonly sms: SmsSender,
    telegram?: TelegramSender,
  ) {
    this.telegram = telegram ?? new LoggingTelegramSender();
  }

  async drainOutbox(limit = 50): Promise<DrainResult> {
    const rows = await this.repos.notifications.drainQueued(limit);
    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const row of rows) {
      // Snapshot attempts BEFORE any mutation (in-memory fake returns references).
      const attemptsNow = row.attempts;

      // Resolve reachable channels. Telegram (free) is preferred when the user has
      // linked it; otherwise fall back to SMS via a known/looked-up phone.
      let phone = row.recipientPhone ?? null;
      let telegramId: string | null = null;
      if (row.userId) {
        const contact = await this.repos.profiles.getContact(row.userId);
        phone = phone ?? contact?.phone ?? null;
        telegramId = contact?.telegramUserId ?? null;
      }

      const useTelegram = telegramId !== null;
      if (!useTelegram && !phone) {
        // Nothing resolvable — increment and mark so it doesn't loop forever.
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
        const result = useTelegram
          ? await this.telegram.send({ chatId: telegramId!, body })
          : await this.sms.send({ to: phone!, body });
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
