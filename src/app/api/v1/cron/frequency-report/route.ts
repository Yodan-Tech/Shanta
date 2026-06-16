import { type NextRequest } from "next/server";
import { handle, ok } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { getRepositories } from "@/lib/db/prisma-repositories";

function requireCronSecret(req: NextRequest): void {
  const auth = req.headers.get("Authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    throw ApiError.forbidden("Invalid cron secret.");
  }
}

/**
 * Weekly job — recounts each traveler's trip frequency from the Trip table and
 * updates TravelProfile counts + customsFrequencyTier. Constraint 2.1: frequency
 * data is internal risk data only, never surfaced to clients. Idempotent: running
 * twice in the same week produces the same counts.
 */
export async function GET(req: NextRequest) {
  return handle(async () => {
    requireCronSecret(req);

    const repos = getRepositories();
    const threshold = (await repos.config.getNumber("traveler.frequent_threshold_90d")) ?? 3;

    const now = new Date();
    const window30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const window90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const profiles = await prisma.travelProfile.findMany({
      select: { id: true, userId: true },
    });

    let updated = 0;
    for (const profile of profiles) {
      const [count30, count90, lifetime] = await Promise.all([
        prisma.trip.count({
          where: {
            travelerId: profile.userId,
            status: { in: ["COMPLETED", "ACTIVE"] },
            createdAt: { gte: window30 },
          },
        }),
        prisma.trip.count({
          where: {
            travelerId: profile.userId,
            status: { in: ["COMPLETED", "ACTIVE"] },
            createdAt: { gte: window90 },
          },
        }),
        prisma.trip.count({
          where: {
            travelerId: profile.userId,
            status: "COMPLETED",
          },
        }),
      ]);

      const tier = count90 >= threshold ? "FREQUENT" : "NON_FREQUENT";

      await prisma.travelProfile.update({
        where: { id: profile.id },
        data: {
          tripCountLast30Days: count30,
          tripCountLast90Days: count90,
          tripCountLifetime: lifetime,
          customsFrequencyTier: tier,
        },
      });
      updated++;
    }

    return ok({ updated });
  });
}
