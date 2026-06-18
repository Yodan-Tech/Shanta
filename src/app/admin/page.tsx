import { requireAdmin } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { KpiSummary } from "@/lib/services/analytics-service";

async function fetchKpis(): Promise<KpiSummary | null> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/v1/admin/kpis`,
      { next: { revalidate: 60 } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { data: KpiSummary };
    return data.data;
  } catch { return null; }
}

const navSections = [
  {
    label: "Operations",
    links: [
      { href: "/admin", label: "Dashboard" },
      { href: "/admin/shipments", label: "Shipments" },
      { href: "/admin/disputes", label: "Disputes" },
      { href: "/admin/kyc", label: "KYC Queue" },
      { href: "/admin/escrow", label: "Escrow" },
      { href: "/admin/users", label: "Users" },
    ],
  },
  {
    label: "Intelligence",
    links: [
      { href: "/admin/intelligence", label: "Dashboard" },
      { href: "/admin/receiver-requests", label: "Receiver Requests" },
      { href: "/admin/reliability", label: "Traveler Reliability" },
      { href: "/admin/rules", label: "Rules Engine" },
    ],
  },
  {
    label: "Audit",
    links: [
      { href: "/admin/audit", label: "Audit Log" },
    ],
  },
];

export default async function AdminPage() {
  const admin = await requireAdmin();
  const kpis = await fetchKpis();

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <div className="flex flex-1">
        {/* Sidebar */}
        <nav className="w-56 border-r bg-muted/30 px-4 py-8 flex-shrink-0">
          {navSections.map((section) => (
            <div key={section.label} className="mb-6">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {section.label}
              </p>
              <ul className="space-y-0.5">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <a href={link.href} className="block rounded px-3 py-2 text-sm hover:bg-muted transition-colors">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Main */}
        <main className="flex-1 px-8 py-8 overflow-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground">{admin.email} · {admin.role}</p>
          </div>

          {kpis ? (
            <>
              {/* Primary KPIs */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 mb-8">
                <KpiCard title="Total Shipments" value={kpis.totalShipments} />
                <KpiCard title="Match Rate" value={`${kpis.matchRate}%`} sub={`${kpis.matchedShipments} matched`} />
                <KpiCard title="Completion Rate" value={`${kpis.completionRate}%`} sub={`${kpis.completedShipments} completed`} />
                <KpiCard title="Active Trips" value={kpis.activeTrips} />
                <KpiCard title="Total Revenue" value={`${kpis.totalRevenue.toLocaleString()} ETB`} />
              </div>

              {/* Action-needed section */}
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Action Needed</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
                <KpiCard title="Pending KYC" value={kpis.pendingKyc} href="/admin/kyc" urgent={kpis.pendingKyc > 0} />
                <KpiCard title="Open Escrow (HELD)" value={kpis.openEscrow} href="/admin/escrow" urgent={kpis.openEscrow > 0} />
                <KpiCard title="Disputes" value={kpis.disputedShipments} href="/admin/disputes" urgent={kpis.disputedShipments > 0} />
                <KpiCard title="Open Receiver Requests" value={kpis.openReceiverRequests} href="/admin/receiver-requests" sub="Awaiting a traveler" />
              </div>

              {/* Trends */}
              {kpis.shipmentsTrend.length > 0 && (
                <>
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">14-Day Activity</h2>
                  <div className="grid gap-4 sm:grid-cols-2 mb-8">
                    <TrendCard title="Shipments per Day" data={kpis.shipmentsTrend} valueKey="count" />
                    <TrendCard title="Revenue per Day (ETB)" data={kpis.revenueTrend} valueKey="totalEtb" />
                  </div>
                </>
              )}

              {/* Health indicators */}
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Health</h2>
              <div className="grid gap-4 sm:grid-cols-3 mb-8">
                <KpiCard title="Cancelled Shipments" value={kpis.cancelledShipments} />
                <KpiCard title="Cancel Rate" value={kpis.totalShipments > 0 ? `${Math.round((kpis.cancelledShipments / kpis.totalShipments) * 100)}%` : "0%"} />
                <div>
                  <a href="/admin/intelligence" className="block">
                    <Card className="border-primary/20 hover:border-primary transition-colors cursor-pointer">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Intelligence Dashboard →</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm">Demand, supply, customs, pricing & route analytics</p>
                      </CardContent>
                    </Card>
                  </a>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Loading KPIs…</p>
          )}
        </main>
      </div>
    </div>
  );
}

function KpiCard({
  title, value, sub, href, urgent,
}: { title: string; value: string | number; sub?: string; href?: string; urgent?: boolean }) {
  const inner = (
    <Card className={urgent ? "border-destructive" : undefined}>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold">{value}</span>
          {urgent && <Badge variant="destructive">Action needed</Badge>}
        </div>
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
  return href ? <a href={href}>{inner}</a> : inner;
}

function TrendCard({
  title,
  data,
  valueKey,
}: { title: string; data: { date: string; [k: string]: number | string }[]; valueKey: string }) {
  const max = Math.max(...data.map((d) => Number(d[valueKey])), 1);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-1 h-16">
          {data.map((d, i) => {
            const val = Number(d[valueKey]);
            const height = Math.max(2, Math.round((val / max) * 64));
            return (
              <div key={i} className="flex flex-col items-center flex-1 group">
                <div
                  className="w-full bg-primary/60 rounded-sm group-hover:bg-primary transition-colors"
                  style={{ height: `${height}px` }}
                  title={`${d.date}: ${val.toLocaleString()}`}
                />
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-xs text-muted-foreground">{data[0]?.date?.slice(5)}</span>
          <span className="text-xs text-muted-foreground">{data[data.length - 1]?.date?.slice(5)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
