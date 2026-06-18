import { serverEnv } from "@/lib/env";

/**
 * Telegram message sender PORT — mirrors the SmsSender port. Lets the notification
 * drain deliver status updates over Telegram (free) for users who linked their
 * account, falling back to SMS otherwise. Dev/test uses the logging sender.
 */
export interface TelegramMessage {
  chatId: string; // Telegram user/chat id
  body: string;
}

export interface TelegramResult {
  providerRef?: string | undefined;
}

export interface TelegramSender {
  send(msg: TelegramMessage): Promise<TelegramResult>;
}

/** Dev/test sender — records instead of sending; lets the flow run without a bot token. */
export class LoggingTelegramSender implements TelegramSender {
  readonly sent: TelegramMessage[] = [];
  async send(msg: TelegramMessage): Promise<TelegramResult> {
    this.sent.push(msg);
    if (process.env.NODE_ENV !== "test") {
      console.log(`[telegram:dev] chat=${msg.chatId} body=${msg.body}`);
    }
    return { providerRef: `tg-dev-${crypto.randomUUID()}` };
  }
}

/** Real sender — calls the Telegram Bot API sendMessage endpoint. */
export class BotApiTelegramSender implements TelegramSender {
  constructor(private readonly token: string) {}

  async send({ chatId, body }: TelegramMessage): Promise<TelegramResult> {
    const res = await fetch(
      `https://api.telegram.org/bot${this.token}/sendMessage`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: body }),
      },
    );
    if (!res.ok) {
      throw new Error(`Telegram sendMessage failed: ${res.status}`);
    }
    const json = (await res.json()) as { result?: { message_id?: number } };
    return {
      providerRef: json.result?.message_id
        ? `tg-${json.result.message_id}`
        : undefined,
    };
  }
}

/** Resolve the active Telegram sender — real if a bot token is configured, else logging. */
export function getTelegramSender(): TelegramSender {
  const token = serverEnv.telegramBotToken;
  return token ? new BotApiTelegramSender(token) : new LoggingTelegramSender();
}
