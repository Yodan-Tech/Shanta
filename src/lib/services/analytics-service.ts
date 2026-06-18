import { prisma } from "@/lib/prisma";

/**
 * AnalyticsService — admin "data intelligence" surface (M20). Read-only aggregates
 * over the immutable facts the platform already records (shipments, items, trips,
 * demand signals, customs events, restriction checks). Prisma-backed reporting.
 *
 * Constraint 2.1: frequency is reported for RISK only — there is no leaderboard,
 * ranking, or reward surface for high-frequency travelers anywhere here.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export interface RouteCount {
  originRegion: string;
  destinationRegion: string;
  count: number;
}

export interface DemandReport {
  /** Most-searched routes (where senders/bot looked). */
  topSearchedRoutes: RouteCount[];
  /** Routes where a match attempt found no carrier — the unmet-demand signal. */
  unmetRoutes: RouteCount[];
  /** Item categories actually shipped (what's in demand), last 30 days. */
  topCategories: { category: string; shipments: number }[];
}

export interface SupplyReport {
  activeTrips: number;
  /** Free capacity (kg) currently offered per route. */
  capacityByRoute: { originRegion: string; destinationRegion: string; availableKg: number }[];
  /** Frequency-tier distribution — RISK metric only (Constraint 2.1). */
  frequencyTiers: { tier: string; travelers: number }[];
}

export interface CustomsReport {
  /** Real customs outcomes captured by ops, by category. */
  outcomes: { category: string; outcome: string; count: number }[];
  /** Items the rules engine flagged at submission/intake, by result. */
  ruleFlags: { result: string; count: number }[];
}

export interface RouteReport {
  /** Per-route shipment volume and completion. */
  routes: { originRegion: string; destinationRegion: string; total: number; completed: number }[];
}

export class AnalyticsService {
  async demand(windowDays = 30): Promise<DemandReport> {
    const since = new Date(Date.now() - windowDays * DAY_MS);

    const searched = await prisma.demandSignal.groupBy({
      by: ["originRegion", "destinationRegion"],
      _count: { _all: true },
      orderBy: { _count: { originRegion: "desc" } },
      take: 10,
    });

    const unmet = await prisma.demandSignal.groupBy({
      by: ["originRegion", "destinationRegion"],
      where: { source: "NO_MATCH" },
      _count: { _all: true },
      orderBy: { _count: { originRegion: "desc" } },
      take: 10,
    });

    const categories = await prisma.item.groupBy({
      by: ["category"],
      where: { createdAt: { gte: since }, deletedAt: null },
      _count: { _all: true },
      orderBy: { _count: { category: "desc" } },
      take: 10,
    });

    return {
      topSearchedRoutes: searched.map((r) => ({
        originRegion: r.originRegion,
        destinationRegion: r.destinationRegion,
        count: r._count._all,
      })),
      unmetRoutes: unmet.map((r) => ({
        originRegion: r.originRegion,
        destinationRegion: r.destinationRegion,
        count: r._count._all,
      })),
      topCategories: categories.map((c) => ({
        category: c.category,
        shipments: c._count._all,
      })),
    };
  }

  async supply(): Promise<SupplyReport> {
    const activeTrips = await prisma.trip.count({ where: { status: "ACTIVE" } });

    const capacity = await prisma.tripLeg.groupBy({
      by: ["originRegion", "destinationRegion"],
      where: { status: "ACTIVE", availableCapacityKg: { gt: 0 } },
      _sum: { availableCapacityKg: true },
      orderBy: { _sum: { availableCapacityKg: "desc" } },
      take: 10,
    });

    const tiers = await prisma.travelProfile.groupBy({
      by: ["customsFrequencyTier"],
      _count: { _all: true },
    });

    return {
      activeTrips,
      capacityByRoute: capacity.map((c) => ({
        originRegion: c.originRegion,
        destinationRegion: c.destinationRegion,
        availableKg: Number(c._sum.availableCapacityKg ?? 0),
      })),
      frequencyTiers: tiers.map((t) => ({
        tier: t.customsFrequencyTier,
        travelers: t._count._all,
      })),
    };
  }

  async customs(): Promise<CustomsReport> {
    const outcomes = await prisma.customsEvent.groupBy({
      by: ["itemCategory", "outcome"],
      _count: { _all: true },
      orderBy: { _count: { itemCategory: "desc" } },
      take: 50,
    });

    const flags = await prisma.restrictionCheck.groupBy({
      by: ["result"],
      _count: { _all: true },
    });

    return {
      outcomes: outcomes.map((o) => ({
        category: o.itemCategory,
        outcome: o.outcome,
        count: o._count._all,
      })),
      ruleFlags: flags.map((f) => ({ result: f.result, count: f._count._all })),
    };
  }

  async routes(): Promise<RouteReport> {
    const totals = await prisma.shipment.groupBy({
      by: ["originRegion", "destinationRegion"],
      where: { deletedAt: null },
      _count: { _all: true },
      orderBy: { _count: { originRegion: "desc" } },
      take: 20,
    });

    const completed = await prisma.shipment.groupBy({
      by: ["originRegion", "destinationRegion"],
      where: { deletedAt: null, status: "COMPLETED" },
      _count: { _all: true },
    });

    const completedMap = new Map(
      completed.map((c) => [`${c.originRegion}→${c.destinationRegion}`, c._count._all]),
    );

    return {
      routes: totals.map((t) => ({
        originRegion: t.originRegion,
        destinationRegion: t.destinationRegion,
        total: t._count._all,
        completed: completedMap.get(`${t.originRegion}→${t.destinationRegion}`) ?? 0,
      })),
    };
  }
}
