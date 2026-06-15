import type { TripMode } from "@prisma/client";
import { ApiError } from "@/lib/api/errors";
import type {
  Repositories,
  TripWithLegs,
  CreateTripLegData,
} from "@/lib/db/ports";

export interface CreateTripInput {
  travelerId: string;
  mode: TripMode;
  countryCode: string;
  legs: CreateTripLegData[];
}

/** TripService — traveler supply: publishing trips and listing one's own trips. */
export class TripService {
  constructor(private readonly repos: Repositories) {}

  async create(input: CreateTripInput): Promise<TripWithLegs> {
    if (input.legs.length === 0) {
      throw ApiError.badRequest("A trip needs at least one leg.");
    }
    for (const leg of input.legs) {
      if (leg.arriveAt && leg.arriveAt.getTime() < leg.departAt.getTime()) {
        throw ApiError.badRequest(
          `Leg ${leg.sequence}: arrival cannot be before departure.`,
        );
      }
      if (leg.totalCapacityKg <= 0) {
        throw ApiError.badRequest(
          `Leg ${leg.sequence}: capacity must be greater than 0.`,
        );
      }
    }
    return this.repos.trips.create({
      travelerId: input.travelerId,
      mode: input.mode,
      countryCode: input.countryCode,
      legs: input.legs,
    });
  }

  async listForTraveler(travelerId: string): Promise<TripWithLegs[]> {
    return this.repos.trips.listByTraveler(travelerId);
  }
}
