import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Stateless, signed receiver-confirmation token (SMS-first receivers have no login).
 * Encodes `{ shipmentId, exp }` and an HMAC so the confirm endpoint can verify it
 * without a DB lookup or a session. Pure + unit-tested. The secret is server-only.
 *
 * Format: base64url(payloadJson) + "." + base64url(hmac).
 */

export interface DeliveryTokenPayload {
  shipmentId: string;
  /** Expiry, epoch ms. */
  exp: number;
}

export type VerifyResult =
  | { ok: true; shipmentId: string }
  | { ok: false; reason: "MALFORMED" | "BAD_SIGNATURE" | "EXPIRED" };

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function sign(payloadB64: string, secret: string): string {
  return b64url(createHmac("sha256", secret).update(payloadB64).digest());
}

export function signDeliveryToken(
  shipmentId: string,
  secret: string,
  opts: { ttlMs?: number; now?: number } = {},
): string {
  const now = opts.now ?? Date.now();
  const payload: DeliveryTokenPayload = {
    shipmentId,
    exp: now + (opts.ttlMs ?? DEFAULT_TTL_MS),
  };
  const payloadB64 = b64url(Buffer.from(JSON.stringify(payload)));
  return `${payloadB64}.${sign(payloadB64, secret)}`;
}

export function verifyDeliveryToken(
  token: string,
  secret: string,
  now: number = Date.now(),
): VerifyResult {
  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, reason: "MALFORMED" };
  const [payloadB64, sig] = parts as [string, string];

  const expected = sign(payloadB64, secret);
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return { ok: false, reason: "BAD_SIGNATURE" };
  }

  let payload: DeliveryTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "MALFORMED" };
  }
  if (typeof payload.shipmentId !== "string" || typeof payload.exp !== "number") {
    return { ok: false, reason: "MALFORMED" };
  }
  if (now > payload.exp) return { ok: false, reason: "EXPIRED" };

  return { ok: true, shipmentId: payload.shipmentId };
}
