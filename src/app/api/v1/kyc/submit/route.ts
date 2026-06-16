import { type NextRequest } from "next/server";
import { handle, ok } from "@/lib/api/response";
import { requireApiProfile } from "@/lib/api/context";
import { getRepositories } from "@/lib/db/prisma-repositories";
import { uploadKycDocument } from "@/lib/storage/kyc-storage";
import { StorageValidationError } from "@/lib/storage/handoff-storage";
import { ApiError } from "@/lib/api/errors";

const MAX_SIZE = 10 * 1024 * 1024;

export function POST(req: NextRequest) {
  return handle(async () => {
    const profile = await requireApiProfile();
    const repos = getRepositories();

    // Parse multipart form data.
    const form = await req.formData().catch(() => {
      throw ApiError.badRequest("Expected multipart/form-data with an 'id_document' file.");
    });
    const file = form.get("id_document");
    if (!(file instanceof File)) {
      throw ApiError.badRequest("Missing 'id_document' file field.");
    }
    if (file.size === 0) {
      throw ApiError.badRequest("Uploaded file is empty.");
    }
    if (file.size > MAX_SIZE) {
      throw ApiError.badRequest("File exceeds 10MB limit.");
    }

    const buffer = new Uint8Array(await file.arrayBuffer());

    let uploadResult: Awaited<ReturnType<typeof uploadKycDocument>>;
    try {
      uploadResult = await uploadKycDocument(buffer, { userId: profile.id });
    } catch (err) {
      if (err instanceof StorageValidationError) {
        throw ApiError.unprocessable(err.message);
      }
      throw err;
    }

    await repos.kyc.submit({
      userId: profile.id,
      idDocumentUrl: uploadResult.path,
    });

    return ok({ status: "PENDING_REVIEW" });
  });
}
