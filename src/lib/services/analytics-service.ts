import { prisma } from "@/lib/prisma";

/**
 * AnalyticsService — admin "data intelligence" surface. Read-only aggregates
 * over the immutable facts the platform records. Prisma-backed reporting.
 *
 * Constraint 2.1: frequency is RISK-only. No leaderboards, no rankings,
 * no rewards based on frequency here or in any caller.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

// ── Demand ────────────────────────────────────────────────────────────────────

export interface RouteCount {
  originRegion: string;
  destinationRegion: string;
  count: number;
}

export interface DemandReport {
  topSearchedRoutes: RouteCount[];
  unmetRoutes: RouteCount[];
  topCategories: { category: string; shipments: number }[];
  receiverRequests: {
    open: number;
    offered: number;
    fulfilled: number;
    topCategories: { category: string; count: number }[];
    topRoutes: RouteCount[];
  };
  demandByDay: { date: string; signals: number }[];
}

export interface SupplyReport {
  activeTrips: number;
  totalCapacityKg: number;
  capacityByRoute: { originRegion: string; destinationRegion: string; availableKg: number }[];
  frequencyTiers: { tier: string; travelers: number }[];
  reliabilityTiers: { tier: string; travelers: number }[];
  travelersByKycStatus: { status: string; count: number }[];
  avgCapacityPerTrip: number;
}

export interface CustomsReport {
  outcomes: { category: string; outcome: string; count: number; totalTaxEtb: number }[];
  ruleFlags: { result: string; count: number }[];
  taxedByCategory: { category: string; totalTaxEtb: number; events: number }[];
  flagRateByRoute: { originRegion: string; destinationRegion: string; flagged: number; total: number; flagRate: number }[];
  recentEvents: {
    id: string;
    itemCategory: string;
    originRegion: string;
    destinationRegion: string;
    outcome: string;
    taxAmountEtb: number | null;
    createdAt: Date;
  }[];
}

export interface RouteReport {
  routes: {
    originRegion: string;
    destinationRegion: string;
    total: number;
    completed: number;
    completionRate: number;
    avgPriceEtb: number;
    totalRevenueEtb: number;
    international: boolean;
  }[];
}

export interface PricingReport {
  corridors: {
    originRegion: string;
    destinationRegion: string;
    ratePerKgEtb: number;
    minChargeEtb: number;
    aggregatorFlatFeeEtb: number;
    platformCommissionRate: number;
    insuranceRate: number;
  }[];
  pricingTiers: {
    itemCategory: string;
    corridorCode: string | null;
    pricingBasis: string;
    rateMultiplier: number;
    flatFeeEtb: number;
    luggageFlatFeeEtb: number | null;
  }[];
  revenueByCategory: { category: string; totalEtb: number; shipments: number; avgEtb: number }[];
  revenueByRoute: { originRegion: string; destinationRegion: string; totalEtb: number; shipments: number }[];
  feeBreakdown: {
    totalCarrierEtb: number;
    totalAggregatorEtb: number;
    totalPlatformEtb: number;
    totalInsuranceEtb: number;
    totalTaxEtb: number;
    grandTotalEtb: number;
  };
}

export interface ReliabilityReport {
  byTier: { tier: string; count: number; avgScore: number }[];
  flaggedTravelers: {
    travelerId: string;
    reliabilityTier: string;
    reliabilityScore: number;
    disputeRate: number;
    completedDeliveries: number;
    disputedDeliveries: number;
    noShowCount: number;
    sealTamperCount: number;
    flagReason: string | null;
    lastUpdatedAt: Date;
  }[];
  overallStats: {
    totalTracked: number;
    avgScore: number;
    trustedCount: number;
    flaggedCount: number;
    suspendedCount: number;
  };
}

export interface KpiSummary {
  totalShipments: number;
  matchedShipments: number;
  completedShipments: number;
  disputedShipments: number;
  cancelledShipments: number;
  activeTrips: number;
  totalRevenue: number;
  pendingKyc: number;
  openEscrow: number;
  openReceiverRequests: number;
  matchRate: number;
  completionRate: number;
  // 7-day trend
  shipmentsTrend: { date: string; count: number }[];
  revenueTrend: { date: string; totalEtb: number }[];
}

export class AnalyticsService {
  async kpis(): Promise<KpiSummary> {
    const matchedStatuses = [
      "MATCHED_TO_TRAVELER", "TRAVELER_REVIEWED", "TRAVELER_ACCEPTED",
      "WITH_TRAVELER", "IN_TRANSIT", "AT_DESTINATION_HUB", "OUT_FOR_DELIVERY",
      "DELIVERED", "DELIVERY_CONFIRMED", "COMPLETED", "ESCROW_RELEASED",
    ];

    const [
      totalShipments, matchedShipments, completedShipments, disputedShipments,
      cancelledShipments, activeTrips, pendingKyc, openEscrow, openReceiverRequests,
      revenueResult, trend, revenueTrend,
    ] = await Promise.all([
      prisma.shipment.count({ where: { deletedAt: null } }),
      prisma.shipment.count({ where: { status: { in: matchedStatuses as never[] }, deletedAt: null } }),
      prisma.shipment.count({ where: { status: { in: ["COMPLETED", "ESCROW_RELEASED"] }, deletedAt: null } }),
      prisma.shipment.count({ where: { status: "DISPUTED", deletedAt: null } }),
      prisma.shipment.count({ where: { status: "CANCELLED", deletedAt: null } }),
      prisma.trip.count({ where: { status: "ACTIVE", deletedAt: null } }),
      prisma.profile.count({ where: { kycStatus: "PENDING_REVIEW", deletedAt: null } }),
      prisma.escrowRecord.count({ where: { status: "HELD" } }),
      prisma.receiverRequest.count({ where: { status: "OPEN" } }),
      prisma.shipment.aggregate({ _sum: { totalPriceEtb: true }, where: { deletedAt: null } }),
      // 14-day shipment trend
      prisma.$queryRaw<{ date: string; count: bigint }[]>`
        SELECT DATE("createdAt") as date, COUNT(*) as count
        FROM shipments
        WHERE "createdAt" >= NOW() - INTERVAL '14 days' AND "deletedAt" IS NULL
        GROUP BY DATE("createdAt")
        ORDER BY date ASC
      `,
      prisma.$queryRaw<{ date: string; total: string }[]>`
        SELECT DATE("createdAt") as date, SUM("totalPriceEtb") as total
        FROM shipments
        WHERE "createdAt" >= NOW() - INTERVAL '14 days' AND "deletedAt" IS NULL
        GROUP BY DATE("createdAt")
        ORDER BY date ASC
      `,
    ]);

    return {
      totalShipments,
      matchedShipments,
      completedShipments,
      disputedShipments,
      cancelledShipments,
      activeTrips,
      totalRevenue: Number(revenueResult._sum.totalPriceEtb ?? 0),
      pendingKyc,
      openEscrow,
      openReceiverRequests,
      matchRate: totalShipments > 0 ? Math.round((matchedShipments / totalShipments) * 100) : 0,
      completionRate: totalShipments > 0 ? Math.round((completedShipments / totalShipments) * 100) : 0,
      shipmentsTrend: trend.map((r) => ({ date: String(r.date), count: Number(r.count) })),
      revenueTrend: revenueTrend.map((r) => ({ date: String(r.date), totalEtb: Number(r.total ?? 0) })),
    };
  }

  async demand(windowDays = 30): Promise<DemandReport> {
    const since = new Date(Date.now() - windowDays * DAY_MS);

    const [searched, unmet, categories, rrOpen, rrOffered, rrFulfilled, rrCategories, rrRoutes, byDay] =
      await Promise.all([
        prisma.demandSignal.groupBy({
          by: ["originRegion", "destinationRegion"],
          _count: { _all: true },
          orderBy: { _count: { originRegion: "desc" } },
          take: 10,
        }),
        prisma.demandSignal.groupBy({
          by: ["originRegion", "destinationRegion"],
          where: { source: "NO_MATCH" },
          _count: { _all: true },
          orderBy: { _count: { originRegion: "desc" } },
          take: 10,
        }),
        prisma.item.groupBy({
          by: ["category"],
          where: { createdAt: { gte: since }, deletedAt: null },
          _count: { _all: true },
          orderBy: { _count: { category: "desc" } },
          take: 10,
        }),
        prisma.receiverRequest.count({ where: { status: "OPEN" } }),
        prisma.receiverRequest.count({ where: { status: "OFFERED" } }),
        prisma.receiverRequest.count({ where: { status: "FULFILLED" } }),
        prisma.receiverRequest.groupBy({
          by: ["itemCategory"],
          _count: { _all: true },
          orderBy: { _count: { itemCategory: "desc" } },
          take: 8,
        }),
        prisma.receiverRequest.groupBy({
          by: ["originRegion", "destinationRegion"],
          _count: { _all: true },
          orderBy: { _count: { originRegion: "desc" } },
          take: 8,
        }),
        prisma.$queryRaw<{ date: string; signals: bigint }[]>`
          SELECT DATE("createdAt") as date, COUNT(*) as signals
          FROM demand_signals
          WHERE "createdAt" >= NOW() - INTERVAL '30 days'
          GROUP BY DATE("createdAt") ORDER BY date ASC
        `,
      ]);

    return {
      topSearchedRoutes: searched.map((r) => ({ originRegion: r.originRegion, destinationRegion: r.destinationRegion, count: r._count._all })),
      unmetRoutes: unmet.map((r) => ({ originRegion: r.originRegion, destinationRegion: r.destinationRegion, count: r._count._all })),
      topCategories: categories.map((c) => ({ category: c.category, shipments: c._count._all })),
      receiverRequests: {
        open: rrOpen,
        offered: rrOffered,
        fulfilled: rrFulfilled,
        topCategories: rrCategories.map((c) => ({ category: c.itemCategory, count: c._count._all })),
        topRoutes: rrRoutes.map((r) => ({ originRegion: r.originRegion, destinationRegion: r.destinationRegion, count: r._count._all })),
      },
      demandByDay: byDay.map((r) => ({ date: String(r.date), signals: Number(r.signals) })),
    };
  }

  async supply(): Promise<SupplyReport> {
    const [activeTrips, capacity, capacitySum, tiers, reliabilityTiers, kycCounts] = await Promise.all([
      prisma.trip.count({ where: { status: "ACTIVE" } }),
      prisma.tripLeg.groupBy({
        by: ["originRegion", "destinationRegion"],
        where: { status: "ACTIVE", availableCapacityKg: { gt: 0 } },
        _sum: { availableCapacityKg: true },
        orderBy: { _sum: { availableCapacityKg: "desc" } },
        take: 10,
      }),
      prisma.tripLeg.aggregate({ _sum: { availableCapacityKg: true }, where: { status: "ACTIVE" } }),
      prisma.travelProfile.groupBy({
        by: ["customsFrequencyTier"],
        _count: { _all: true },
      }),
      prisma.travelerReliability.groupBy({
        by: ["reliabilityTier"],
        _count: { _all: true },
      }),
      prisma.profile.groupBy({
        by: ["kycStatus"],
        where: { roles: { has: "TRAVELER" }, deletedAt: null },
        _count: { _all: true },
      }),
    ]);

    const totalCap = Number(capacitySum._sum.availableCapacityKg ?? 0);

    return {
      activeTrips,
      totalCapacityKg: totalCap,
      avgCapacityPerTrip: activeTrips > 0 ? Math.round(totalCap / activeTrips) : 0,
      capacityByRoute: capacity.map((c) => ({
        originRegion: c.originRegion,
        destinationRegion: c.destinationRegion,
        availableKg: Number(c._sum.availableCapacityKg ?? 0),
      })),
      frequencyTiers: tiers.map((t) => ({ tier: t.customsFrequencyTier, travelers: t._count._all })),
      reliabilityTiers: reliabilityTiers.map((t) => ({ tier: t.reliabilityTier, travelers: t._count._all })),
      travelersByKycStatus: kycCounts.map((k) => ({ status: k.kycStatus, count: k._count._all })),
    };
  }

  async customs(): Promise<CustomsReport> {
    const [outcomes, flags, taxed, recent, routeOutcomes] = await Promise.all([
      prisma.customsEvent.groupBy({
        by: ["itemCategory", "outcome"],
        _count: { _all: true },
        _sum: { taxAmountEtb: true },
        orderBy: { _count: { itemCategory: "desc" } },
        take: 50,
      }),
      prisma.restrictionCheck.groupBy({
        by: ["result"],
        _count: { _all: true },
      }),
      prisma.customsEvent.groupBy({
        by: ["itemCategory"],
        where: { outcome: "TAXED" },
        _count: { _all: true },
        _sum: { taxAmountEtb: true },
        orderBy: { _sum: { taxAmountEtb: "desc" } },
        take: 10,
      }),
      prisma.customsEvent.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, itemCategory: true, originRegion: true, destinationRegion: true, outcome: true, taxAmountEtb: true, createdAt: true },
      }),
      prisma.customsEvent.groupBy({
        by: ["originRegion", "destinationRegion"],
        _count: { _all: true },
        orderBy: { _count: { originRegion: "desc" } },
        take: 10,
      }),
    ]);

    // Compute flag rate per route from restriction checks + shipments
    const flaggedByRoute = await prisma.$queryRaw<{ origin: string; dest: string; flagged: bigint; total: bigint }[]>`
      SELECT s."originRegion" as origin, s."destinationRegion" as dest,
             COUNT(CASE WHEN rc.result != 'PASS' THEN 1 END) as flagged,
             COUNT(*) as total
      FROM restriction_checks rc
      JOIN shipments s ON s.id = rc."shipmentId"
      GROUP BY s."originRegion", s."destinationRegion"
      ORDER BY flagged DESC LIMIT 10
    `;

    return {
      outcomes: outcomes.map((o) => ({
        category: o.itemCategory,
        outcome: o.outcome,
        count: o._count._all,
        totalTaxEtb: Number(o._sum.taxAmountEtb ?? 0),
      })),
      ruleFlags: flags.map((f) => ({ result: f.result, count: f._count._all })),
      taxedByCategory: taxed.map((t) => ({
        category: t.itemCategory,
        totalTaxEtb: Number(t._sum.taxAmountEtb ?? 0),
        events: t._count._all,
      })),
      flagRateByRoute: flaggedByRoute.map((r) => ({
        originRegion: r.origin,
        destinationRegion: r.dest,
        flagged: Number(r.flagged),
        total: Number(r.total),
        flagRate: Number(r.total) > 0 ? Math.round((Number(r.flagged) / Number(r.total)) * 100) : 0,
      })),
      recentEvents: recent.map((e) => ({
        ...e,
        taxAmountEtb: e.taxAmountEtb ? Number(e.taxAmountEtb) : null,
      })),
    };
  }

  async routes(): Promise<RouteReport> {
    const [totals, completed, revenue] = await Promise.all([
      prisma.shipment.groupBy({
        by: ["originRegion", "destinationRegion"],
        where: { deletedAt: null },
        _count: { _all: true },
        orderBy: { _count: { originRegion: "desc" } },
        take: 20,
      }),
      prisma.shipment.groupBy({
        by: ["originRegion", "destinationRegion"],
        where: { deletedAt: null, status: "COMPLETED" },
        _count: { _all: true },
      }),
      prisma.shipment.groupBy({
        by: ["originRegion", "destinationRegion"],
        where: { deletedAt: null },
        _sum: { totalPriceEtb: true },
        _avg: { totalPriceEtb: true },
      }),
    ]);

    const routeConfigs = await prisma.routeConfig.findMany({ where: { active: true }, select: { originRegion: true, destinationRegion: true, international: true } });
    const intlMap = new Map(routeConfigs.map((r) => [`${r.originRegion}→${r.destinationRegion}`, r.international]));
    const completedMap = new Map(completed.map((c) => [`${c.originRegion}→${c.destinationRegion}`, c._count._all]));
    const revenueMap = new Map(revenue.map((r) => [`${r.originRegion}→${r.destinationRegion}`, { total: Number(r._sum.totalPriceEtb ?? 0), avg: Number(r._avg.totalPriceEtb ?? 0) }]));

    return {
      routes: totals.map((t) => {
        const key = `${t.originRegion}→${t.destinationRegion}`;
        const comp = completedMap.get(key) ?? 0;
        const rev = revenueMap.get(key) ?? { total: 0, avg: 0 };
        return {
          originRegion: t.originRegion,
          destinationRegion: t.destinationRegion,
          total: t._count._all,
          completed: comp,
          completionRate: t._count._all > 0 ? Math.round((comp / t._count._all) * 100) : 0,
          avgPriceEtb: Math.round(rev.avg),
          totalRevenueEtb: Math.round(rev.total),
          international: intlMap.get(key) ?? false,
        };
      }),
    };
  }

  async pricing(): Promise<PricingReport> {
    const [corridors, tiers, revenueByCategory, revenueByRoute, feeAgg] = await Promise.all([
      prisma.corridorPricing.findMany({
        where: {
          effectiveFrom: { lte: new Date() },
          OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: new Date() } }],
        },
        orderBy: { originRegion: "asc" },
      }),
      prisma.pricingTier.findMany({
        where: { active: true },
        orderBy: { itemCategory: "asc" },
      }),
      prisma.$queryRaw<{ category: string; total: string; count: bigint }[]>`
        SELECT i.category, SUM(s."totalPriceEtb") as total, COUNT(DISTINCT s.id) as count
        FROM items i
        JOIN shipments s ON s.id = i."shipmentId"
        WHERE s."deletedAt" IS NULL
        GROUP BY i.category ORDER BY total DESC LIMIT 15
      `,
      prisma.shipment.groupBy({
        by: ["originRegion", "destinationRegion"],
        where: { deletedAt: null },
        _sum: { totalPriceEtb: true },
        _count: { _all: true },
        orderBy: { _sum: { totalPriceEtb: "desc" } },
        take: 15,
      }),
      prisma.shipment.aggregate({
        _sum: { carrierFeeEtb: true, aggregatorFeeEtb: true, platformFeeEtb: true, insurancePremiumEtb: true, taxAmountEtb: true, totalPriceEtb: true },
        where: { deletedAt: null },
      }),
    ]);

    return {
      corridors: corridors.map((c) => ({
        originRegion: c.originRegion,
        destinationRegion: c.destinationRegion,
        ratePerKgEtb: Number(c.ratePerKgEtb),
        minChargeEtb: Number(c.minChargeEtb),
        aggregatorFlatFeeEtb: Number(c.aggregatorFlatFeeEtb),
        platformCommissionRate: Number(c.platformCommissionRate),
        insuranceRate: Number(c.insuranceRate),
      })),
      pricingTiers: tiers.map((t) => ({
        itemCategory: t.itemCategory,
        corridorCode: t.corridorCode,
        pricingBasis: t.pricingBasis,
        rateMultiplier: Number(t.rateMultiplier),
        flatFeeEtb: Number(t.flatFeeEtb),
        luggageFlatFeeEtb: t.luggageFlatFeeEtb ? Number(t.luggageFlatFeeEtb) : null,
      })),
      revenueByCategory: revenueByCategory.map((r) => ({
        category: r.category,
        totalEtb: Number(r.total ?? 0),
        shipments: Number(r.count),
        avgEtb: Number(r.count) > 0 ? Math.round(Number(r.total ?? 0) / Number(r.count)) : 0,
      })),
      revenueByRoute: revenueByRoute.map((r) => ({
        originRegion: r.originRegion,
        destinationRegion: r.destinationRegion,
        totalEtb: Number(r._sum.totalPriceEtb ?? 0),
        shipments: r._count._all,
      })),
      feeBreakdown: {
        totalCarrierEtb: Number(feeAgg._sum.carrierFeeEtb ?? 0),
        totalAggregatorEtb: Number(feeAgg._sum.aggregatorFeeEtb ?? 0),
        totalPlatformEtb: Number(feeAgg._sum.platformFeeEtb ?? 0),
        totalInsuranceEtb: Number(feeAgg._sum.insurancePremiumEtb ?? 0),
        totalTaxEtb: Number(feeAgg._sum.taxAmountEtb ?? 0),
        grandTotalEtb: Number(feeAgg._sum.totalPriceEtb ?? 0),
      },
    };
  }

  async reliability(): Promise<ReliabilityReport> {
    const [byTier, flagged, stats] = await Promise.all([
      prisma.travelerReliability.groupBy({
        by: ["reliabilityTier"],
        _count: { _all: true },
        _avg: { reliabilityScore: true },
      }),
      prisma.travelerReliability.findMany({
        where: { reliabilityTier: { in: ["FLAGGED", "SUSPENDED"] } },
        orderBy: { reliabilityScore: "asc" },
        take: 50,
        select: {
          travelerId: true, reliabilityTier: true, reliabilityScore: true,
          disputeRate: true, completedDeliveries: true, disputedDeliveries: true,
          noShowCount: true, sealTamperCount: true, flagReason: true, lastUpdatedAt: true,
        },
      }),
      prisma.travelerReliability.aggregate({
        _count: { _all: true },
        _avg: { reliabilityScore: true },
      }),
    ]);

    const tierCounts = Object.fromEntries(byTier.map((t) => [t.reliabilityTier, t._count._all]));

    return {
      byTier: byTier.map((t) => ({
        tier: t.reliabilityTier,
        count: t._count._all,
        avgScore: Math.round(Number(t._avg.reliabilityScore ?? 0) * 100) / 100,
      })),
      flaggedTravelers: flagged.map((f) => ({
        ...f,
        reliabilityScore: Number(f.reliabilityScore),
        disputeRate: Number(f.disputeRate),
      })),
      overallStats: {
        totalTracked: stats._count._all,
        avgScore: Math.round(Number(stats._avg.reliabilityScore ?? 0) * 100) / 100,
        trustedCount: tierCounts["TRUSTED"] ?? 0,
        flaggedCount: tierCounts["FLAGGED"] ?? 0,
        suspendedCount: tierCounts["SUSPENDED"] ?? 0,
      },
    };
  }
}
