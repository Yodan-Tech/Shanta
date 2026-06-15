import { Role } from "@prisma/client";
import { handle, ok } from "@/lib/api/response";
import { requireApiRole } from "@/lib/api/context";
import { getRepositories } from "@/lib/db/prisma-repositories";
import { ShipmentService } from "@/lib/services/shipment-service";

// GET /api/v1/shipments/:id — fetch one of the sender's shipments.
export function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const profile = await requireApiRole(Role.SENDER);
    const { id } = await params;
    const svc = new ShipmentService(getRepositories());
    return ok(await svc.getForSender(id, profile.id));
  });
}
