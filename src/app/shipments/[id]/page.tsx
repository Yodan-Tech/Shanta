import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { getRepositories } from "@/lib/db/prisma-repositories";
import { ShipmentService } from "@/lib/services/shipment-service";
import { AppHeader } from "@/components/app-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

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

export default async function ShipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireProfile();
  const { id } = await params;
  const repos = getRepositories();
  const svc = new ShipmentService(repos);

  let shipment;
  try {
    shipment = await svc.getForSender(id, profile.id);
  } catch {
    notFound();
  }

  const historyRes = await repos.shipments.findById(id);
  if (!historyRes) notFound();

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
        <div className="mb-4 flex items-center gap-3">
          <Link href="/shipments" className="text-sm text-muted hover:underline">
            ← My shipments
          </Link>
        </div>

        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold">
              {shipment.originRegion} → {shipment.destinationRegion}
            </h1>
            <p className="mt-1 text-sm text-muted font-mono">{shipment.id.slice(0, 8)}…</p>
          </div>
          <Badge variant={STATUS_VARIANT[shipment.status] ?? "secondary"}>
            {shipment.status.replace(/_/g, " ")}
          </Badge>
        </div>

        <div className="space-y-4">
          {/* Items */}
          <Card>
            <CardHeader><CardTitle className="text-base">Items</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {shipment.items.map((item) => (
                  <li key={item.id} className="flex justify-between text-sm">
                    <span>
                      <span className="font-medium">{item.category}</span>
                      {" — "}{item.description}
                    </span>
                    <span className="text-muted ml-4 shrink-0">
                      {Number(item.declaredWeightKg)} kg
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Receiver */}
          <Card>
            <CardHeader><CardTitle className="text-base">Receiver</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm font-medium">{shipment.receiverName}</p>
              <p className="text-sm text-muted">{shipment.receiverPhone}</p>
            </CardContent>
          </Card>

          {/* Pricing */}
          <Card>
            <CardHeader><CardTitle className="text-base">Pricing</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-1 text-sm">
                <Row label="Carrier fee" value={`ETB ${Number(shipment.carrierFeeEtb).toFixed(2)}`} />
                <Row label="Hub fee" value={`ETB ${Number(shipment.aggregatorFeeEtb).toFixed(2)}`} />
                <Row label="Platform fee" value={`ETB ${Number(shipment.platformFeeEtb).toFixed(2)}`} />
                {Number(shipment.insurancePremiumEtb) > 0 && (
                  <Row label="Insurance" value={`ETB ${Number(shipment.insurancePremiumEtb).toFixed(2)}`} />
                )}
                <div className="border-t border-border pt-1 mt-1">
                  <Row label="Total" value={`ETB ${Number(shipment.totalPriceEtb).toFixed(2)}`} bold />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold" : ""}`}>
      <span className="text-muted">{label}</span>
      <span>{value}</span>
    </div>
  );
}
