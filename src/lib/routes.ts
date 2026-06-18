import { RestrictionDirection } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Per-route behavior resolution (ADR-0003). Pricing and rules already key off
 * region pairs; RouteConfig adds the behavior layer so each route (intra-ET vs
 * Ethio↔Dubai) is unique without hardcoding any route in code. Unconfigured routes
 * default to a domestic, customs-intelligence-off profile.
 */
export interface RouteContext {
  /** RouteConfig.code — also used as the corridorCode for rule overrides. */
  corridorCode: string | null;
  /** Customs direction for rule resolution (ENTRY into ET / EXIT from ET / BOTH). */
  direction: RestrictionDirection;
  international: boolean;
  customsIntelligence: boolean;
  allowAggregationOnly: boolean;
  currency: string;
}

const DEFAULT_CONTEXT: RouteContext = {
  corridorCode: null,
  direction: RestrictionDirection.BOTH,
  international: false,
  customsIntelligence: false,
  allowAggregationOnly: true,
  currency: "ETB",
};

export async function resolveRouteContext(
  originRegion: string,
  destinationRegion: string,
): Promise<RouteContext> {
  const route = await prisma.routeConfig.findFirst({
    where: { originRegion, destinationRegion, active: true },
  });
  if (!route) return DEFAULT_CONTEXT;

  const cfg = (route.config ?? {}) as { direction?: string };
  const direction =
    cfg.direction === "ENTRY"
      ? RestrictionDirection.ENTRY
      : cfg.direction === "EXIT"
        ? RestrictionDirection.EXIT
        : RestrictionDirection.BOTH;

  return {
    corridorCode: route.code,
    direction,
    international: route.international,
    customsIntelligence: route.customsIntelligence,
    allowAggregationOnly: route.allowAggregationOnly,
    currency: route.currency,
  };
}
