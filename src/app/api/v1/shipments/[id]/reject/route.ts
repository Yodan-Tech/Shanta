import type { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { handle, ok } from "@/lib/api/response";
import { requireApiRole } from "@/lib/api/context";
import { rejectSchema } from "@/lib/api/schemas";
import { getRepositories } from "@/lib/db/prisma-repositories";
import { MatchService } from "@/lib/services/match-service";

// POST /api/v1/shipments/:id/reject — traveler declines (TRAVELER, a NORMAL outcome).
// Body: { reason? }. Restores trip-leg capacity and re-queues → AWAITING_MATCH.
export function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const profile = await requireApiRole(Role.TRAVELER);
    const { id } = await params;
    const body = rejectSchema.parse(await req.json().catch(() => ({})));

    const svc = new MatchService(getRepositories());
    const out = await svc.reject({
      shipmentId: id,
      travelerId: profile.id,
      ...(body.reason ? { reason: body.reason } : {}),
    });
    return ok(out);
  });
}
