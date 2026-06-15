import type { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { handle, ok } from "@/lib/api/response";
import { requireApiRole } from "@/lib/api/context";
import { acceptSchema } from "@/lib/api/schemas";
import { getRepositories } from "@/lib/db/prisma-repositories";
import { MatchService } from "@/lib/services/match-service";

// POST /api/v1/shipments/:id/accept — traveler accepts custody (TRAVELER). Body:
// { acknowledgmentText, sealIntact }. Records the verbatim acknowledgment + intact-seal
// check; → TRAVELER_ACCEPTED → WITH_TRAVELER, and marks escrow HELD if one exists.
export function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const profile = await requireApiRole(Role.TRAVELER);
    const { id } = await params;
    const body = acceptSchema.parse(await req.json());

    const svc = new MatchService(getRepositories());
    const out = await svc.accept({
      shipmentId: id,
      travelerId: profile.id,
      acknowledgmentText: body.acknowledgmentText,
      sealIntact: body.sealIntact,
    });
    return ok(out);
  });
}
