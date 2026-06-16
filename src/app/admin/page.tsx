import { requireAdmin } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Kpis {
  totalShipments: number;
  matchedShipments: number;
  completedShipments: number;
  disputedShipments: number;
  activeTrips: number;
  pendingKyc: number;
  openEscrow: number;
  matchRate: number;
  completionRate: number;
}

async function fetchKpis(): Promise<Kpis | null> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/v1/admin/kpis`,
      { next: { revalidate: 60 } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { data: Kpis };
    return data.data;
  } catch {
    return null;
  }
}

export default async function AdminPage() {
  const admin = await requireAdmin();
  const kpis = await fetchKpis();

  const navLinks = [
    { href: "/admin/shipments", label: "Shipments" },
    { href: "/admin/disputes", label: "Disputes" },
    { href: "/admin/kyc", label: "KYC Queue" },
    { href: "/admin/rules", label: "Rules" },
    { href: "/admin/escrow", label: "Escrow" },
    { href: "/admin/users", label: "Users" },
    { href: "/admin/audit", label: "Audit Log" },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <div className="flex flex-1">
        {/* Sidebar */}
        <nav className="w-56 border-r bg-muted/30 px-4 py-8">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Admin
          </p>
          <ul className="space-y-1">
            {navLinks.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="block rounded px-3 py-2 text-sm hover:bg-muted"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Main */}
        <main className="flex-1 px-8 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              {admin.email} · {admin.role}
            </p>
          </div>

          {kpis ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <KpiCard title="Total Shipments" value={kpis.totalShipments} />
              <KpiCard
                title="Match Rate"
                value={`${kpis.matchRate}%`}
                sub={`${kpis.matchedShipments} matched`}
              />
              <KpiCard
                title="Completion Rate"
                value={`${kpis.completionRate}%`}
                sub={`${kpis.completedShipments} completed`}
              />
              <KpiCard title="Active Trips" value={kpis.activeTrips} />
              <KpiCard
                title="Pending KYC"
                value={kpis.pendingKyc}
                href="/admin/kyc"
                urgent={kpis.pendingKyc > 0}
              />
              <KpiCard
                title="Open Escrow (HELD)"
                value={kpis.openEscrow}
                href="/admin/escrow?status=HELD"
              />
              <KpiCard
                title="Disputes"
                value={kpis.disputedShipments}
                href="/admin/disputes"
                urgent={kpis.disputedShipments > 0}
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Loading KPIs…</p>
          )}
        </main>
      </div>
    </div>
  );
}

function KpiCard({
  title,
  value,
  sub,
  href,
  urgent,
}: {
  title: string;
  value: string | number;
  sub?: string;
  href?: string;
  urgent?: boolean;
}) {
  const inner = (
    <Card className={urgent ? "border-destructive" : undefined}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
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
