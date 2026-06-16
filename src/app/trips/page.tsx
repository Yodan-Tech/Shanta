import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { getRepositories } from "@/lib/db/prisma-repositories";
import { TripService } from "@/lib/services/trip-service";
import { AppHeader } from "@/components/app-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function TripsPage() {
  const profile = await requireProfile();
  const repos = getRepositories();
  const svc = new TripService(repos);
  const trips = await svc.listForTraveler(profile.id);

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-bold">My Trips</h1>
          <Link href="/trips/new">
            <Button>+ New trip</Button>
          </Link>
        </div>

        {trips.length === 0 ? (
          <div className="mt-16 text-center">
            <p className="text-muted">You have no trips registered yet.</p>
            <Link href="/trips/new">
              <Button className="mt-4">Register your first trip</Button>
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {trips.map((trip) => {
              const leg = trip.legs[0];
              return (
                <li key={trip.id}>
                  <Link href={`/trips/${trip.id}`}>
                    <div className="flex items-center justify-between rounded-lg border border-border p-4 hover:bg-surface transition-colors">
                      <div>
                        <p className="font-medium">
                          {leg ? `${leg.originRegion} → ${leg.destinationRegion}` : "—"}
                        </p>
                        <p className="mt-0.5 text-sm text-muted">
                          {leg ? new Date(leg.departAt).toLocaleDateString() : ""}
                          {leg
                            ? ` · ${Number(leg.availableCapacityKg)} kg available`
                            : ""}
                        </p>
                      </div>
                      <Badge variant={trip.status === "ACTIVE" ? "success" : "outline"}>
                        {trip.status}
                      </Badge>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
