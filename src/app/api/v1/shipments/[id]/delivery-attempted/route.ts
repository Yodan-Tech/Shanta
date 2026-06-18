import type { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { handle, ok } from "@/lib/api/response";
import { requireApiRole } from "@/lib/api/context";
import { deliveryService } from "@/lib/api/wiring";

// POST /api/v1/shipments/:id/delivery-attempted — pickup attempt failed (AGGREGATOR).
// OUT_FOR_DELIVERY → DELIVERY_ATTEMPTED (retry via out-for-delivery, or escalate).
export function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const profile = await requireApiRole(Role.AGGREGATOR);
    const { id } = await params;
    const shipment = await deliveryService().attempted(id, profile.id);
    return ok({ shipment });
  });
}
