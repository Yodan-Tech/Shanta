import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { getRepositories } from "@/lib/db/prisma-repositories";
import { TripService } from "@/lib/services/trip-service";
import { AppHeader } from "@/components/app-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireProfile();
  const { id } = await params;
  const repos = getRepositories();
  const svc = new TripService(repos);

  const trips = await svc.listForTraveler(profile.id);
  const trip = trips.find((t) => t.id === id);
  if (!trip) notFound();

  const leg = trip.legs[0];

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
        <div className="mb-4">
          <Link href="/trips" className="text-sm text-muted hover:underline">
            ← My trips
          </Link>
        </div>

        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold">
              {leg ? `${leg.originRegion} → ${leg.destinationRegion}` : "Trip"}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {leg ? new Date(leg.departAt).toLocaleString() : ""}
            </p>
          </div>
          <Badge variant={trip.status === "ACTIVE" ? "success" : "outline"}>
            {trip.status}
          </Badge>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Capacity</CardTitle></CardHeader>
            <CardContent>
              {leg ? (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">Total</span>
                    <span>{Number(leg.totalCapacityKg)} kg</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">Available</span>
                    <span className="font-semibold">{Number(leg.availableCapacityKg)} kg</span>
                  </div>
                  {/* Capacity bar */}
                  <div className="mt-2 h-2 rounded-full bg-surface overflow-hidden">
                    <div
                      className="h-full rounded-full bg-navy"
                      style={{
                        width: `${Math.round(
                          (Number(leg.availableCapacityKg) / Number(leg.totalCapacityKg)) * 100,
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted">No legs.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Mode</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm">{trip.mode}</p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
