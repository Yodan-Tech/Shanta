import { getServiceClient } from "@/lib/supabase/admin";

/**
 * Handoff photo storage (Constraint 2.2 verification chain). Private Supabase
 * Storage bucket; uploads are validated by MAGIC BYTES (never trust the client's
 * Content-Type or filename), size-capped, and served only via short-lived signed
 * URLs whose issuance is logged. Live-capture enforcement for delivery photos is a
 * service-layer concern (the route requires captureMethod=LIVE).
 */

export const HANDOFF_BUCKET = "handoff-photos";
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10 MB
export const SIGNED_URL_TTL_SECONDS = 3600; // 1 hour

export type ImageMime = "image/jpeg" | "image/png" | "image/webp";

/**
 * Sniff the real image type from the leading bytes. Returns null for anything that
 * is not a JPEG/PNG/WebP — a renamed script, a PDF, an empty file, etc. Pure and
 * unit-tested; this is the security boundary, so it must not trust metadata.
 */
export function sniffImageMime(bytes: Uint8Array): ImageMime | null {
  if (bytes.length < 12) return null;
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  // WebP: "RIFF" .... "WEBP"
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

const EXT: Record<ImageMime, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export class StorageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageValidationError";
  }
}

export interface UploadedPhoto {
  path: string;
  mime: ImageMime;
  bytes: number;
}

/**
 * Validate (magic bytes + size) and upload one handoff photo to the private bucket.
 * Returns the storage object path stored on the HandoffRecord. Throws
 * StorageValidationError on a non-image or oversize file.
 */
export async function uploadHandoffPhoto(
  buffer: Uint8Array,
  opts: { shipmentId: string; kind: string },
): Promise<UploadedPhoto> {
  if (buffer.length === 0) throw new StorageValidationError("Empty file.");
  if (buffer.length > MAX_PHOTO_BYTES) {
    throw new StorageValidationError("File exceeds the 10MB limit.");
  }
  const mime = sniffImageMime(buffer);
  if (!mime) {
    throw new StorageValidationError(
      "File is not a valid JPEG, PNG, or WebP image.",
    );
  }

  const path = `${opts.shipmentId}/${opts.kind}/${crypto.randomUUID()}.${EXT[mime]}`;
  const { error } = await getServiceClient()
    .storage.from(HANDOFF_BUCKET)
    .upload(path, buffer, { contentType: mime, upsert: false });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  return { path, mime, bytes: buffer.length };
}

/** Issue a short-lived signed URL for a stored handoff photo (read access is logged by the caller). */
export async function signedHandoffUrl(
  path: string,
  ttlSeconds: number = SIGNED_URL_TTL_SECONDS,
): Promise<string> {
  const { data, error } = await getServiceClient()
    .storage.from(HANDOFF_BUCKET)
    .createSignedUrl(path, ttlSeconds);
  if (error || !data) {
    throw new Error(`Could not sign URL: ${error?.message ?? "unknown"}`);
  }
  return data.signedUrl;
}
