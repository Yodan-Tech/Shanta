import type { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { handle, ok } from "@/lib/api/response";
import { requireApiRole } from "@/lib/api/context";
import { sealPayloadSchema } from "@/lib/api/schemas";
import { uploadPhotos, parseJsonField } from "@/lib/api/uploads";
import { getRepositories } from "@/lib/db/prisma-repositories";
import { HandoffService } from "@/lib/services/handoff-service";

// POST /api/v1/shipments/:id/seal — apply the tamper seal (AGGREGATOR). Multipart
// form: `photo` (≥1 seal image) + `payload` JSON { sealId }. Only valid AFTER
// verification; advances CONTENTS_VERIFIED → SEALED → AWAITING_MATCH and stamps the
// seal id onto every item.
export function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const profile = await requireApiRole(Role.AGGREGATOR);
    const { id } = await params;
    const form = await req.formData();
    const payload = sealPayloadSchema.parse(parseJsonField(form, "payload"));
    const photoUrls = await uploadPhotos(form, { shipmentId: id, kind: "seal" });

    const svc = new HandoffService(getRepositories());
    const out = await svc.seal({
      shipmentId: id,
      operatorId: profile.id,
      sealId: payload.sealId,
      photoUrls,
    });
    return ok(out);
  });
}
