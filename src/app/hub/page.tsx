import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppHeader } from "@/components/app-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function HubPage() {
  await requireProfile();

  // Fetch shipments awaiting hub intake
  const shipments = await prisma.shipment.findMany({
    where: {
      status: { in: ["AWAITING_HUB_INTAKE", "AT_ORIGIN_HUB", "WEIGHT_DISCREPANCY"] },
      deletedAt: null,
    },
    include: { items: true },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  const statusLabel: Record<string, string> = {
    AWAITING_HUB_INTAKE: "Awaiting intake",
    AT_ORIGIN_HUB: "At hub (verify)",
    WEIGHT_DISCREPANCY: "Weight issue",
  };

  const statusVariant: Record<string, "info" | "warning" | "default"> = {
    AWAITING_HUB_INTAKE: "info",
    AT_ORIGIN_HUB: "default",
    WEIGHT_DISCREPANCY: "warning",
  };

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        <h1 className="mb-6 text-xl font-bold">Hub Console</h1>

        {shipments.length === 0 ? (
          <div className="mt-16 text-center">
            <p className="text-muted">No shipments waiting for intake.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {shipments.map((s) => (
              <li key={s.id}>
                <div className="rounded-lg border border-border p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">
                        {s.originRegion} → {s.destinationRegion}
                      </p>
                      <p className="text-sm text-muted mt-0.5">
                        {s.items.length} item{s.items.length !== 1 ? "s" : ""} ·{" "}
                        {s.items.reduce(
                          (sum, it) => sum + Number(it.declaredWeightKg),
                          0,
                        ).toFixed(1)}{" "}
                        kg declared
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant={statusVariant[s.status] ?? "default"}>
                        {statusLabel[s.status] ?? s.status}
                      </Badge>
                      <Link href={`/hub/${s.id}`}>
                        <Button size="sm" variant="outline">
                          {s.status === "AWAITING_HUB_INTAKE" ? "Start intake" : "Continue"}
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
