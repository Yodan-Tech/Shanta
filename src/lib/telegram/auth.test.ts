import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { verifyTelegramLogin, MAX_AUTH_AGE_SECONDS } from "./auth";

const BOT_TOKEN = "123456:test-bot-token";

/** Sign a payload exactly as Telegram's login widget does. */
function sign(fields: Record<string, string | number>): Record<string, unknown> {
  const dataCheckString = Object.entries(fields)
    .map(([k, v]) => [k, String(v)] as const)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secret = crypto.createHash("sha256").update(BOT_TOKEN).digest();
  const hash = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");
  return { ...fields, hash };
}

describe("verifyTelegramLogin", () => {
  const now = Date.now();
  const authDate = Math.floor(now / 1000);

  it("accepts a correctly signed, fresh payload", () => {
    const payload = sign({ id: 42, username: "abebe", first_name: "Abebe", auth_date: authDate });
    const result = verifyTelegramLogin(payload, BOT_TOKEN, now);
    expect(result).not.toBeNull();
    expect(result?.telegramUserId).toBe("42");
    expect(result?.username).toBe("abebe");
    expect(result?.fullName).toBe("Abebe");
  });

  it("rejects a tampered payload (wrong hash)", () => {
    const payload = sign({ id: 42, auth_date: authDate });
    payload.id = 99; // tamper after signing
    expect(verifyTelegramLogin(payload, BOT_TOKEN, now)).toBeNull();
  });

  it("rejects a payload signed with a different bot token", () => {
    const payload = sign({ id: 42, auth_date: authDate });
    expect(verifyTelegramLogin(payload, "999:other-token", now)).toBeNull();
  });

  it("rejects a stale payload (replay protection)", () => {
    const stale = authDate - MAX_AUTH_AGE_SECONDS - 10;
    const payload = sign({ id: 42, auth_date: stale });
    expect(verifyTelegramLogin(payload, BOT_TOKEN, now)).toBeNull();
  });

  it("rejects when no bot token is configured", () => {
    const payload = sign({ id: 42, auth_date: authDate });
    expect(verifyTelegramLogin(payload, "", now)).toBeNull();
  });

  it("rejects a payload missing the hash", () => {
    expect(verifyTelegramLogin({ id: 42, auth_date: authDate }, BOT_TOKEN, now)).toBeNull();
  });
});
