import {
  uploadHandoffPhoto,
  StorageValidationError,
} from "@/lib/storage/handoff-storage";
import { ApiError } from "./errors";

/**
 * Parse, validate (magic bytes, in the storage layer), and upload the photo files
 * from a multipart form. Returns the stored object paths. A non-image / oversize
 * file becomes a 422 rather than a 500. Live-capture is enforced by the service.
 */
export async function uploadPhotos(
  form: FormData,
  opts: { shipmentId: string; kind: string; field?: string; min?: number },
): Promise<string[]> {
  const field = opts.field ?? "photo";
  const min = opts.min ?? 1;
  const files = form.getAll(field).filter((f): f is File => f instanceof File);
  if (files.length < min) {
    throw ApiError.unprocessable(`At least ${min} '${field}' file(s) required.`);
  }

  const paths: string[] = [];
  for (const file of files) {
    const buffer = new Uint8Array(await file.arrayBuffer());
    try {
      const uploaded = await uploadHandoffPhoto(buffer, {
        shipmentId: opts.shipmentId,
        kind: opts.kind,
      });
      paths.push(uploaded.path);
    } catch (e) {
      if (e instanceof StorageValidationError) {
        throw ApiError.unprocessable(e.message);
      }
      throw e;
    }
  }
  return paths;
}

/** Parse a JSON form field into an unknown for Zod, with a clean 400 on bad JSON. */
export function parseJsonField(form: FormData, field: string): unknown {
  const raw = form.get(field);
  try {
    return JSON.parse(typeof raw === "string" ? raw : "{}");
  } catch {
    throw ApiError.badRequest(`Invalid JSON in '${field}' field.`);
  }
}
