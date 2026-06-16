import { getServiceClient } from "@/lib/supabase/admin";
import {
  sniffImageMime,
  MAX_PHOTO_BYTES,
  SIGNED_URL_TTL_SECONDS,
  StorageValidationError,
  type ImageMime,
} from "./handoff-storage";

export const KYC_BUCKET = "kyc-docs";

export interface UploadedKycDoc {
  path: string;
  mime: ImageMime;
  bytes: number;
}

/**
 * Validate (magic bytes + size) and upload a KYC identity document to the
 * private kyc-docs bucket. Path: kyc/{userId}/{uuid}.{ext}.
 * Never publicly accessible — served only via admin-issued signed URLs.
 */
export async function uploadKycDocument(
  buffer: Uint8Array,
  opts: { userId: string },
): Promise<UploadedKycDoc> {
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

  const ext = mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : "webp";
  const path = `kyc/${opts.userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await getServiceClient()
    .storage.from(KYC_BUCKET)
    .upload(path, buffer, { contentType: mime, upsert: false });
  if (error) throw new Error(`KYC storage upload failed: ${error.message}`);

  return { path, mime, bytes: buffer.length };
}

/** Issue a short-lived signed URL for a KYC document (admin use only). */
export async function signedKycUrl(
  path: string,
  ttlSeconds: number = SIGNED_URL_TTL_SECONDS,
): Promise<string> {
  const { data, error } = await getServiceClient()
    .storage.from(KYC_BUCKET)
    .createSignedUrl(path, ttlSeconds);
  if (error || !data) {
    throw new Error(`Could not sign KYC URL: ${error?.message ?? "unknown"}`);
  }
  return data.signedUrl;
}
