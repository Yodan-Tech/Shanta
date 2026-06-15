import type { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { handle, ok } from "@/lib/api/response";
import { requireApiRole } from "@/lib/api/context";
import { intakePayloadSchema } from "@/lib/api/schemas";
import { uploadPhotos, parseJsonField } from "@/lib/api/uploads";
import { getRepositories } from "@/lib/db/prisma-repositories";
import { HandoffService } from "@/lib/services/handoff-service";

// POST /api/v1/shipments/:id/intake — hub intake (AGGREGATOR). Multipart form:
//   - photo: one or more intake images (magic-byte validated)
//   - payload: JSON { itemWeights:[{itemId,actualWeightKg}], cashChecked, geoLat?, geoLng? }
// Derives all guard context server-side; advances → AT_ORIGIN_HUB (or WEIGHT_DISCREPANCY).
export function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const profile = await requireApiRole(Role.AGGREGATOR);
    const { id } = await params;
    const form = await req.formData();
    const payload = intakePayloadSchema.parse(parseJsonField(form, "payload"));
    const photoUrls = await uploadPhotos(form, { shipmentId: id, kind: "intake" });

    const svc = new HandoffService(getRepositories());
    const out = await svc.intake({
      shipmentId: id,
      operatorId: profile.id,
      photoUrls,
      itemWeights: payload.itemWeights,
      cashChecked: payload.cashChecked,
      ...(payload.geoLat != null ? { geoLat: payload.geoLat } : {}),
      ...(payload.geoLng != null ? { geoLng: payload.geoLng } : {}),
    });
    return ok(out);
  });
}
