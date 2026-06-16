import Link from "next/link";
import { getRepositories } from "@/lib/db/prisma-repositories";
import { ShipmentService } from "@/lib/services/shipment-service";
import { requireProfile } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const STATUS_VARIANT: Record<string, "default" | "success" | "warning" | "destructive" | "info" | "outline"> = {
  COMPLETED: "success",
  ESCROW_RELEASED: "success",
  DELIVERY_CONFIRMED: "success",
  DISPUTED: "destructive",
  CANCELLED: "outline",
  WEIGHT_DISCREPANCY: "warning",
  AWAITING_HUB_INTAKE: "info",
  AT_ORIGIN_HUB: "info",
  IN_TRANSIT: "info",
  DELIVERED: "info",
};

export default async function ShipmentsPage() {
  const profile = await requireProfile();
  const repos = getRepositories();
  const svc = new ShipmentService(repos);
  const shipments = await svc.listForSender(profile.id);

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-bold">My Shipments</h1>
          <Link href="/shipments/new">
            <Button>+ New shipment</Button>
          </Link>
        </div>

        {shipments.length === 0 ? (
          <div className="mt-16 text-center">
            <p className="text-muted">You haven&apos;t sent anything yet.</p>
            <Link href="/shipments/new">
              <Button className="mt-4">Send your first package</Button>
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {shipments.map((s) => (
              <li key={s.id}>
                <Link href={`/shipments/${s.id}`}>
                  <div className="flex items-center justify-between rounded-lg border border-border p-4 hover:bg-surface transition-colors">
                    <div>
                      <p className="font-medium">{s.originRegion} → {s.destinationRegion}</p>
                      <p className="text-sm text-muted mt-0.5">
                        {new Date(s.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant={STATUS_VARIANT[s.status] ?? "secondary"}>
                      {s.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
