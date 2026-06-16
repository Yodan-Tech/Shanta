import { handle, ok } from "@/lib/api/response";
import { requireApiAdminRole } from "@/lib/api/context";
import { prisma } from "@/lib/prisma";

export function GET() {
  return handle(async () => {
    await requireApiAdminRole("OPERATIONS", "SUPER_ADMIN");

    const disputes = await prisma.shipment.findMany({
      where: { status: "DISPUTED", deletedAt: null },
      include: {
        items: true,
        escrow: true,
        handoffs: { orderBy: { capturedAt: "asc" } },
      },
      orderBy: { updatedAt: "desc" },
    });

    return ok({ items: disputes, total: disputes.length });
  });
}
