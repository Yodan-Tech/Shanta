import type { NextRequest } from "next/server";
import { AdminRole } from "@prisma/client";
import { handle, ok } from "@/lib/api/response";
import { requireApiAdminRole } from "@/lib/api/context";
import { escrowRefundSchema } from "@/lib/api/schemas";
import { getRepositories } from "@/lib/db/prisma-repositories";
import { EscrowService } from "@/lib/services/escrow-service";

// POST /api/v1/admin/escrow/:id/refund — refund a non-settled hub escrow (FINANCE).
// :id is the SHIPMENT id. Refunds the held logistics fee (sender cancellation,
// return, or a dispute resolved for the sender); the admin then routes the shipment
// to CANCELLED / RETURNED_TO_SENDER via the transition endpoint.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async (correlationId) => {
    const admin = await requireApiAdminRole(AdminRole.FINANCE);
    const { id } = await params;
    const body = escrowRefundSchema.parse(
      await req.json().catch(() => ({})),
    );

    const svc = new EscrowService(getRepositories());
    const escrow = await svc.refund({
      shipmentId: id,
      adminId: admin.id,
      ...(body.reason ? { reason: body.reason } : {}),
    });
    return ok({ escrow });
  });
}
