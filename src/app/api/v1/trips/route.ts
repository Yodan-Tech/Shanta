import type { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { handle, ok, created } from "@/lib/api/response";
import { requireApiRole } from "@/lib/api/context";
import { createTripSchema } from "@/lib/api/schemas";
import { getRepositories } from "@/lib/db/prisma-repositories";
import { TripService } from "@/lib/services/trip-service";

// POST /api/v1/trips — publish a trip with capacity. Traveler role (KYC checked by service later).
export function POST(req: NextRequest) {
  return handle(async () => {
    const profile = await requireApiRole(Role.TRAVELER);
    const body = createTripSchema.parse(await req.json());
    const svc = new TripService(getRepositories());
    const trip = await svc.create({
      travelerId: profile.id,
      countryCode: profile.countryCode,
      mode: body.mode,
      legs: body.legs.map((l) => ({
        sequence: l.sequence,
        originRegion: l.originRegion,
        destinationRegion: l.destinationRegion,
        departAt: l.departAt,
        totalCapacityKg: l.totalCapacityKg,
        ...(l.arriveAt ? { arriveAt: l.arriveAt } : {}),
      })),
    });
    return created(trip);
  });
}

// GET /api/v1/trips — list the current traveler's trips.
export function GET() {
  return handle(async () => {
    const profile = await requireApiRole(Role.TRAVELER);
    const svc = new TripService(getRepositories());
    return ok(await svc.listForTraveler(profile.id));
  });
}
