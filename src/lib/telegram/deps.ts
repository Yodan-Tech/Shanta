import { TripMode, type Language } from "@prisma/client";
import { getRepositories } from "@/lib/db/prisma-repositories";
import { prisma } from "@/lib/prisma";
import { publicEnv } from "@/lib/env";
import { summarizeCaps } from "@/lib/domain/rules-engine";
import { ShipmentService } from "@/lib/services/shipment-service";
import { TripService } from "@/lib/services/trip-service";
import { ensureTelegramProfile } from "./profile";
import { resolveRouteContext } from "@/lib/routes";
import type { BotDeps } from "./bot";

/**
 * Live BotDeps — wires the pure bot router to repositories, services, and Prisma.
 * Region strings are passed through as the canonical values the rest of the system
 * uses (CorridorPricing/RouteConfig keys).
 */
export function liveBotDeps(): BotDeps {
  const repos = getRepositories();
  const shipmentService = new ShipmentService(repos);
  const tripService = new TripService(repos);
  const country = publicEnv.countryCode;

  return {
    async ensureProfile(tg) {
      const profile = await ensureTelegramProfile(tg);
      return { id: profile.id, language: profile.preferredLanguage };
    },

    async setLanguage(profileId, language: Language) {
      await prisma.profile.update({
        where: { id: profileId },
        data: { preferredLanguage: language },
      });
    },

    async listTravelers(originRegion, destinationRegion) {
      return repos.trips.listActiveLegsByRoute({
        originRegion,
        destinationRegion,
        fromDate: new Date(),
        limit: 10,
      });
    },

    async packableCaps(originRegion, destinationRegion) {
      const rules = await repos.rules.findActive(country);
      const route = await resolveRouteContext(originRegion, destinationRegion);
      return summarizeCaps(rules, {
        corridorCode: route.corridorCode,
        direction: route.direction,
      });
    },

    async createShipment(input) {
      const route = await resolveRouteContext(
        input.originRegion,
        input.destinationRegion,
      );
      const { shipment, price } = await shipmentService.create({
        senderId: input.senderId,
        receiverName: input.receiverName,
        receiverPhone: input.receiverPhone,
        originRegion: input.originRegion,
        destinationRegion: input.destinationRegion,
        corridorCode: route.corridorCode,
        direction: route.direction,
        countryCode: country,
        insuranceOptedIn: false,
        items: [
          {
            category: input.category,
            description: input.category,
            quantity: input.units,
            declaredWeightKg: input.weightKg,
          },
        ],
      });
      return { id: shipment.id, totalPriceEtb: price.totalPriceEtb };
    },

    async listShipments(profileId) {
      const shipments = await shipmentService.listForSender(profileId);
      return shipments.map((s) => ({
        id: s.id,
        status: s.status,
        originRegion: s.originRegion,
        destinationRegion: s.destinationRegion,
      }));
    },

    async createTrip(input) {
      const trip = await tripService.create({
        travelerId: input.travelerId,
        mode: TripMode.FLIGHT,
        countryCode: country,
        legs: [
          {
            sequence: 1,
            originRegion: input.originRegion,
            destinationRegion: input.destinationRegion,
            departAt: input.departAt,
            totalCapacityKg: input.capacityKg,
          },
        ],
      });
      return { id: trip.id };
    },

    async logDemand(originRegion, destinationRegion, category) {
      try {
        await prisma.demandSignal.create({
          data: {
            originRegion,
            destinationRegion,
            ...(category ? { itemCategory: category } : {}),
            source: "BOT_QUERY",
            countryCode: country,
          },
        });
      } catch {
        // Best-effort intelligence capture — never blocks the user.
      }
    },
  };
}
