import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verify an inbound provider-webhook HMAC signature (SMS delivery receipts, etc.).
 * Constant-time compare; the raw request body must be hashed (not a re-serialised
 * object). Every webhook is logged to WebhookLog with `signatureValid` regardless.
 */
export function verifyHmacSignature(
  rawBody: string,
  signature: string,
  secret: string,
  algo: "sha256" | "sha1" = "sha256",
): boolean {
  if (!signature) return false;
  const expected = createHmac(algo, secret).update(rawBody).digest("hex");
  // Allow a "sha256=" style prefix.
  const provided = signature.includes("=") ? signature.split("=").pop()! : signature;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
