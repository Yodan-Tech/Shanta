import type { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { handle, ok } from "@/lib/api/response";
import { requireApiRole } from "@/lib/api/context";
import { deliverPayloadSchema } from "@/lib/api/schemas";
import { uploadPhotos, parseJsonField } from "@/lib/api/uploads";
import { deliveryService } from "@/lib/api/wiring";

// POST /api/v1/shipments/:id/deliver — hub release for pickup (AGGREGATOR). Multipart:
//   - photo: ≥1 LIVE-captured release image (gallery rejected, Constraint 2.2)
//   - payload: JSON { captureMethod, geoLat?, geoLng? }
// → DELIVERED; issues a signed token and SMSs the receiver a no-login pickup link.
// The token is intentionally NOT returned in the response (only the receiver gets it).
export function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const profile = await requireApiRole(Role.AGGREGATOR);
    const { id } = await params;
    const form = await req.formData();
    const payload = deliverPayloadSchema.parse(parseJsonField(form, "payload"));
    const photoUrls = await uploadPhotos(form, { shipmentId: id, kind: "delivery" });

    const out = await deliveryService().deliver({
      shipmentId: id,
      operatorId: profile.id,
      photoUrls,
      captureMethod: payload.captureMethod,
      ...(payload.geoLat != null ? { geoLat: payload.geoLat } : {}),
      ...(payload.geoLng != null ? { geoLng: payload.geoLng } : {}),
    });
    return ok({ shipment: out.shipment, handoff: out.handoff });
  });
}
