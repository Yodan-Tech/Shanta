import type { NextRequest } from "next/server";
import { AuditActorType } from "@prisma/client";
import { handle, ok } from "@/lib/api/response";
import { requireApiAdmin } from "@/lib/api/context";
import { adminTransitionSchema } from "@/lib/api/schemas";
import { getRepositories } from "@/lib/db/prisma-repositories";
import { ShipmentService } from "@/lib/services/shipment-service";

// POST /api/v1/shipments/:id/transition — admin/manual state transition (RUNBOOK
// operations). Safety-critical user transitions get dedicated endpoints later that
// derive guard context server-side from handoff records.
export function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const admin = await requireApiAdmin();
    const { id } = await params;
    const body = adminTransitionSchema.parse(await req.json());

    const svc = new ShipmentService(getRepositories());
    const shipment = await svc.transition({
      shipmentId: id,
      expectedVersion: body.expectedVersion,
      toStatus: body.toStatus,
      actorType: AuditActorType.ADMIN,
      actorId: admin.id,
      ...(body.reason ? { reason: body.reason } : {}),
      ...(body.context ? { context: body.context } : {}),
    });
    return ok(shipment);
  });
}
