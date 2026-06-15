import type { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { handle, ok } from "@/lib/api/response";
import { requireApiRole } from "@/lib/api/context";
import { getRepositories } from "@/lib/db/prisma-repositories";
import { MatchService } from "@/lib/services/match-service";

// POST /api/v1/shipments/:id/review — traveler reviews the sealed-parcel evidence
// (TRAVELER); → TRAVELER_REVIEWED. No body.
export function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const profile = await requireApiRole(Role.TRAVELER);
    const { id } = await params;
    const svc = new MatchService(getRepositories());
    const out = await svc.review({ shipmentId: id, travelerId: profile.id });
    return ok(out);
  });
}
