import { prisma } from "@/lib/prisma";
import { SendForm } from "./send-form";

async function loadPreviewData() {
  const [routes, legs, signals] = await Promise.all([
    prisma.routeConfig.findMany({
      where: { active: true },
      orderBy: [{ international: "desc" }, { updatedAt: "desc" }],
      take: 8,
    }),
    prisma.tripLeg.groupBy({
      by: ["originRegion", "destinationRegion"],
      where: { status: "ACTIVE", trip: { deletedAt: null } },
      _count: { _all: true },
      _sum: { availableCapacityKg: true },
      orderBy: { _count: { originRegion: "desc" } },
      take: 12,
    }),
    prisma.demandSignal.groupBy({
      by: ["originRegion", "destinationRegion"],
      _count: { _all: true },
      orderBy: { _count: { originRegion: "desc" } },
      take: 12,
    }),
  ]);

  return {
    routes: routes.map((route) => ({
      code: route.code,
      originRegion: route.originRegion,
      destinationRegion: route.destinationRegion,
      international: route.international,
      currency: route.currency,
      customsIntelligence: route.customsIntelligence,
      allowAggregationOnly: route.allowAggregationOnly,
    })),
    legs: legs.map((leg) => ({
      originRegion: leg.originRegion,
      destinationRegion: leg.destinationRegion,
      activeLegs: leg._count._all,
      capacityKg: Number(leg._sum.availableCapacityKg ?? 0),
    })),
    signals: signals.map((signal) => ({
      originRegion: signal.originRegion,
      destinationRegion: signal.destinationRegion,
      searches: signal._count._all,
    })),
  };
}

export default async function SendPage() {
  const data = await loadPreviewData();
  return <SendForm previewData={data} />;
}
