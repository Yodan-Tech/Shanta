import crypto from "node:crypto";

/**
 * Telegram Login Widget verification — https://core.telegram.org/widgets/login#checking-authorization
 *
 * The widget returns a signed payload. We recompute the HMAC over the data-check
 * string using SHA256(bot_token) as the key and compare in constant time. Pure and
 * dependency-free so it is fully unit-testable without a live bot.
 */

export interface VerifiedTelegramUser {
  telegramUserId: string;
  username?: string | undefined;
  fullName?: string | undefined;
}

/** Reject auth payloads older than this — replay protection. */
export const MAX_AUTH_AGE_SECONDS = 86_400; // 1 day

export function verifyTelegramLogin(
  payload: Record<string, unknown>,
  botToken: string,
  nowMs: number = Date.now(),
): VerifiedTelegramUser | null {
  const hash = payload.hash;
  if (typeof hash !== "string" || !payload.id || !payload.auth_date) return null;
  if (!botToken) return null;

  // data_check_string: every field except `hash`, "key=value" sorted by key, joined by \n.
  const dataCheckString = Object.entries(payload)
    .filter(([k, v]) => k !== "hash" && v !== undefined && v !== null)
    .map(([k, v]) => [k, String(v)] as const)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const secretKey = crypto.createHash("sha256").update(botToken).digest();
  const computed = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  // Constant-time compare (lengths must match for timingSafeEqual).
  let expected: Buffer;
  let actual: Buffer;
  try {
    expected = Buffer.from(computed, "hex");
    actual = Buffer.from(hash, "hex");
  } catch {
    return null;
  }
  if (expected.length !== actual.length) return null;
  if (!crypto.timingSafeEqual(expected, actual)) return null;

  // Freshness.
  const authDate = Number(payload.auth_date);
  if (!Number.isFinite(authDate)) return null;
  if (Math.floor(nowMs / 1000) - authDate > MAX_AUTH_AGE_SECONDS) return null;

  const fullName = [payload.first_name, payload.last_name]
    .filter((p): p is string => typeof p === "string" && p.length > 0)
    .join(" ");

  return {
    telegramUserId: String(payload.id),
    username: typeof payload.username === "string" ? payload.username : undefined,
    fullName: fullName || undefined,
  };
}
