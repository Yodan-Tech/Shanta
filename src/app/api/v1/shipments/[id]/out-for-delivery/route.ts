import type { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { handle, ok } from "@/lib/api/response";
import { requireApiRole } from "@/lib/api/context";
import { deliveryService } from "@/lib/api/wiring";

// POST /api/v1/shipments/:id/out-for-delivery — dispatch last-mile (AGGREGATOR).
// AT_DESTINATION_HUB → OUT_FOR_DELIVERY.
export function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const profile = await requireApiRole(Role.AGGREGATOR);
    const { id } = await params;
    const shipment = await deliveryService().outForDelivery(id, profile.id);
    return ok({ shipment });
  });
}
