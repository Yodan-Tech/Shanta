import type { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { handle, ok } from "@/lib/api/response";
import { requireApiRole } from "@/lib/api/context";
import { uploadPhotos } from "@/lib/api/uploads";
import { getRepositories } from "@/lib/db/prisma-repositories";
import { HandoffService } from "@/lib/services/handoff-service";

// POST /api/v1/shipments/:id/verify — contents verification (AGGREGATOR). Multipart
// form with ≥1 `photo` (contents images). Advances AT_ORIGIN_HUB → CONTENTS_VERIFIED.
// The state machine makes this impossible before intake and required before sealing.
export function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const profile = await requireApiRole(Role.AGGREGATOR);
    const { id } = await params;
    const form = await req.formData();
    const photoUrls = await uploadPhotos(form, { shipmentId: id, kind: "verify" });

    const svc = new HandoffService(getRepositories());
    const out = await svc.verify({
      shipmentId: id,
      operatorId: profile.id,
      photoUrls,
    });
    return ok(out);
  });
}
