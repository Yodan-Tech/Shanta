import { describe, it, expect } from "vitest";
import { makeInMemoryRepositories } from "@/lib/db/memory";
import { LoggingSmsSender } from "@/lib/sms/sender";
import { LoggingTelegramSender } from "@/lib/telegram/sender";
import { NotificationService } from "./notification-service";

const USER = "user-1";

function setup() {
  const repos = makeInMemoryRepositories({ rules: [], pricing: null });
  const sms = new LoggingSmsSender();
  const telegram = new LoggingTelegramSender();
  const svc = new NotificationService(repos, sms, telegram);
  return { repos, sms, telegram, svc };
}

describe("notification channel routing", () => {
  it("sends over Telegram (free) when the user has linked it", async () => {
    const { repos, sms, telegram, svc } = setup();
    repos.profiles.phones.set(USER, "+251911000001");
    repos.profiles.telegramIds.set(USER, "555");
    repos.notifications.writeSpecs([
      { userId: USER, channel: "SMS", templateKey: "shipment_created", payload: {}, language: "EN" },
    ]);

    const result = await svc.drainOutbox();
    expect(result.sent).toBe(1);
    expect(telegram.sent).toHaveLength(1);
    expect(telegram.sent[0]?.chatId).toBe("555");
    expect(sms.sent).toHaveLength(0);
  });

  it("falls back to SMS when no Telegram is linked", async () => {
    const { repos, sms, telegram, svc } = setup();
    repos.profiles.phones.set(USER, "+251911000001");
    repos.notifications.writeSpecs([
      { userId: USER, channel: "SMS", templateKey: "shipment_created", payload: {}, language: "EN" },
    ]);

    const result = await svc.drainOutbox();
    expect(result.sent).toBe(1);
    expect(sms.sent).toHaveLength(1);
    expect(telegram.sent).toHaveLength(0);
  });

  it("sends receiver SMS (no userId) over SMS", async () => {
    const { repos, sms, telegram, svc } = setup();
    repos.notifications.writeSpecs([
      {
        recipientPhone: "+251922000002",
        channel: "SMS",
        templateKey: "delivery_confirmed",
        payload: {},
        language: "AM",
      },
    ]);

    const result = await svc.drainOutbox();
    expect(result.sent).toBe(1);
    expect(sms.sent[0]?.to).toBe("+251922000002");
    expect(telegram.sent).toHaveLength(0);
  });
});
