import type { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { handle, ok, created } from "@/lib/api/response";
import { requireApiRole } from "@/lib/api/context";
import { createShipmentSchema } from "@/lib/api/schemas";
import { getRepositories } from "@/lib/db/prisma-repositories";
import { ShipmentService } from "@/lib/services/shipment-service";

// POST /api/v1/shipments — create a shipment (runs rules + pricing). Sender role.
export function POST(req: NextRequest) {
  return handle(async () => {
    const profile = await requireApiRole(Role.SENDER);
    const body = createShipmentSchema.parse(await req.json());
    const idempotencyKey =
      req.headers.get("Idempotency-Key") ?? body.idempotencyKey;

    const svc = new ShipmentService(getRepositories());
    const result = await svc.create({
      senderId: profile.id,
      countryCode: profile.countryCode,
      receiverName: body.receiverName,
      receiverPhone: body.receiverPhone,
      originRegion: body.originRegion,
      destinationRegion: body.destinationRegion,
      insuranceOptedIn: body.insuranceOptedIn,
      items: body.items,
      ...(idempotencyKey ? { idempotencyKey } : {}),
    });
    return created(result);
  });
}

// GET /api/v1/shipments — list the current sender's shipments.
export function GET() {
  return handle(async () => {
    const profile = await requireApiRole(Role.SENDER);
    const svc = new ShipmentService(getRepositories());
    return ok(await svc.listForSender(profile.id));
  });
}
