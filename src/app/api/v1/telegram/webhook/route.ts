import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env";
import { getTelegramSender } from "@/lib/telegram/sender";
import { handleBotCommand } from "@/lib/telegram/bot";
import { liveBotDeps } from "@/lib/telegram/deps";
import type { VerifiedTelegramUser } from "@/lib/telegram/auth";
import { log } from "@/lib/logger";

/**
 * Telegram bot webhook. Telegram authenticates the update via the secret token it
 * echoes in the `X-Telegram-Bot-Api-Secret-Token` header (set when registering the
 * webhook), so `message.from` is a trusted identity. We always answer 200 so
 * Telegram does not retry; failures are logged and surfaced to the user as text.
 */

interface TelegramUpdate {
  message?: {
    text?: string;
    from?: {
      id: number;
      username?: string;
      first_name?: string;
      last_name?: string;
    };
  };
}

export async function POST(req: Request): Promise<NextResponse> {
  const correlationId = crypto.randomUUID();

  // Verify the secret token (constant-time-ish via strict equality on a short token).
  const expected = serverEnv.telegramWebhookSecret;
  const provided = req.headers.get("x-telegram-bot-api-secret-token");
  if (!expected || provided !== expected) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = (await req.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: true }); // ignore malformed; don't make Telegram retry
  }

  const msg = update.message;
  if (!msg?.text || !msg.from) {
    return NextResponse.json({ ok: true }); // non-text update (photo, join, etc.) — ignore
  }

  const from: VerifiedTelegramUser = {
    telegramUserId: String(msg.from.id),
    username: msg.from.username,
    fullName: [msg.from.first_name, msg.from.last_name]
      .filter((p): p is string => typeof p === "string" && p.length > 0)
      .join(" ") || undefined,
  };

  try {
    const reply = await handleBotCommand({ text: msg.text, from }, liveBotDeps());
    await getTelegramSender().send({ chatId: from.telegramUserId, body: reply });
  } catch (err) {
    log(correlationId, "error", "Telegram webhook failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    // Best-effort apology; never fail the webhook.
    try {
      await getTelegramSender().send({
        chatId: from.telegramUserId,
        body: "⚠️ Sorry, something went wrong. Please try again.",
      });
    } catch {
      /* ignore */
    }
  }

  return NextResponse.json({ ok: true });
}
