import { RestrictionDirection } from "@prisma/client";
import { resolveRule } from "@/lib/domain/rules-engine";
import { rankTravelers, type TravelerCandidate } from "@/lib/domain/matching";
import type { Repositories } from "@/lib/db/ports";

export interface FindMatchesInput {
  originRegion: string;
  destinationRegion: string;
  windowStart: Date;
  windowEnd: Date;
  itemCategory: string;
  itemWeightKg: number;
  countryCode: string;
}

/**
 * MatchingService — Phase 1 query-based matching (no ML). Loads candidates for a
 * corridor + window, derives the per-category crowding limit from the rules
 * engine, then ranks eligible travelers by the Constraint 2.1 preference
 * (lower frequency first). The operator picks from the ranked list.
 */
export class MatchingService {
  constructor(private readonly repos: Repositories) {}

  async findMatches(input: FindMatchesInput): Promise<TravelerCandidate[]> {
    const rules = await this.repos.rules.findActive(input.countryCode);
    const rule = resolveRule(
      input.itemCategory,
      null,
      new Date(),
      rules,
      RestrictionDirection.BOTH,
    );
    const categoryLimitKg = rule?.maxWeightKg ?? Number.POSITIVE_INFINITY;

    const candidates = await this.repos.trips.searchCandidates({
      originRegion: input.originRegion,
      destinationRegion: input.destinationRegion,
      windowStart: input.windowStart,
      windowEnd: input.windowEnd,
      itemCategory: input.itemCategory,
    });

    return rankTravelers(candidates, {
      itemWeightKg: input.itemWeightKg,
      categoryLimitKg,
    });
  }
}
