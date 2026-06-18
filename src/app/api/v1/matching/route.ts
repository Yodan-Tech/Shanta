import type { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { handle, ok } from "@/lib/api/response";
import { requireApiRole } from "@/lib/api/context";
import { matchingQuerySchema } from "@/lib/api/schemas";
import { getRepositories } from "@/lib/db/prisma-repositories";
import { MatchingService } from "@/lib/services/matching-service";
import { prisma } from "@/lib/prisma";

// GET /api/v1/matching?originRegion&destinationRegion&windowStart&windowEnd&itemCategory&itemWeightKg
// Aggregator finds ranked, eligible travelers for an item (Constraint 2.1 ordering).
export function GET(req: NextRequest) {
  return handle(async () => {
    const profile = await requireApiRole(Role.AGGREGATOR);
    const q = matchingQuerySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams),
    );
    const svc = new MatchingService(getRepositories());
    const matches = await svc.findMatches({
      originRegion: q.originRegion,
      destinationRegion: q.destinationRegion,
      windowStart: q.windowStart,
      windowEnd: q.windowEnd,
      itemCategory: q.itemCategory,
      itemWeightKg: q.itemWeightKg,
      countryCode: profile.countryCode,
    });

    // Intelligence capture (M20): record the search, and a NO_MATCH unmet-demand
    // signal when supply is missing on this route. Best-effort; never blocks.
    void prisma.demandSignal
      .create({
        data: {
          originRegion: q.originRegion,
          destinationRegion: q.destinationRegion,
          itemCategory: q.itemCategory,
          source: matches.length === 0 ? "NO_MATCH" : "SEARCH",
          actorId: profile.id,
          countryCode: profile.countryCode,
        },
      })
      .catch(() => {});

    return ok(matches);
  });
}
