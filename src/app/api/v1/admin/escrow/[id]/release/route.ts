import type { NextRequest } from "next/server";
import { AdminRole } from "@prisma/client";
import { handle, ok } from "@/lib/api/response";
import { requireApiAdminRole } from "@/lib/api/context";
import { escrowReleaseSchema } from "@/lib/api/schemas";
import { getRepositories } from "@/lib/db/prisma-repositories";
import { EscrowService } from "@/lib/services/escrow-service";

// POST /api/v1/admin/escrow/:id/release — release the manual hub escrow (FINANCE).
// :id is the SHIPMENT id (escrow is 1—1 with a shipment). Release is allowed ONLY
// when the shipment is DELIVERY_CONFIRMED and the escrow is HELD — never on a
// DISPUTED shipment (OQ-1 manual escrow; never auto-releases).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async (correlationId) => {
    const admin = await requireApiAdminRole(AdminRole.FINANCE);
    const { id } = await params;
    const body = escrowReleaseSchema.parse(await req.json());

    const svc = new EscrowService(getRepositories());
    const result = await svc.release({
      shipmentId: id,
      expectedVersion: body.expectedVersion,
      adminId: admin.id,
    });
    return ok(result);
  });
}
