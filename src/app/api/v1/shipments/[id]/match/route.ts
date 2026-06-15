import type { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { handle, ok } from "@/lib/api/response";
import { requireApiRole } from "@/lib/api/context";
import { matchSchema } from "@/lib/api/schemas";
import { getRepositories } from "@/lib/db/prisma-repositories";
import { MatchService } from "@/lib/services/match-service";

// POST /api/v1/shipments/:id/match — assign a ranked traveler's trip leg (AGGREGATOR).
// Re-checks capacity + crowding + KYC/active server-side; → MATCHED_TO_TRAVELER. Never
// returns traveler frequency (Constraint 2.1).
export function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const profile = await requireApiRole(Role.AGGREGATOR);
    const { id } = await params;
    const body = matchSchema.parse(await req.json());

    const svc = new MatchService(getRepositories());
    const out = await svc.match({
      shipmentId: id,
      tripLegId: body.tripLegId,
      operatorId: profile.id,
      countryCode: profile.countryCode,
    });
    return ok(out);
  });
}
