import { requireAdmin } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { DemandReport, SupplyReport, CustomsReport, RouteReport, PricingReport } from "@/lib/services/analytics-service";

const APP = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${APP}${path}`, { next: { revalidate: 120 } });
    if (!res.ok) return null;
    const json = (await res.json()) as { data: T };
    return json.data;
  } catch { return null; }
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card>
      <CardHeader className="pb-1"><CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</CardTitle></CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-8">
      <h2 className="text-lg font-semibold mb-3">{title}</h2>
      {children}
    </div>
  );
}

export default async function IntelligencePage() {
  await requireAdmin();

  const [demand, supply, customs, routes, pricing] = await Promise.all([
    fetchJson<DemandReport>("/api/v1/admin/intelligence/demand"),
    fetchJson<SupplyReport>("/api/v1/admin/intelligence/supply"),
    fetchJson<CustomsReport>("/api/v1/admin/intelligence/customs"),
    fetchJson<RouteReport>("/api/v1/admin/intelligence/routes"),
    fetchJson<PricingReport>("/api/v1/admin/intelligence/pricing"),
  ]);

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-8 space-y-2">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Intelligence Dashboard</h1>
        <p className="text-xs text-muted-foreground">Auto-refreshes every 2 minutes</p>
      </div>

      {/* ── Supply snapshot ── */}
      <Section title="Supply">
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
          <Stat label="Active Trips" value={supply?.activeTrips ?? 0} />
          <Stat label="Total Capacity (kg)" value={supply?.totalCapacityKg?.toLocaleString() ?? 0} />
          <Stat label="Avg Capacity / Trip" value={`${supply?.avgCapacityPerTrip ?? 0} kg`} />
          <Stat label="Reliability Tracked" value={supply?.reliabilityTiers?.reduce((s, t) => s + t.travelers, 0) ?? 0} />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {/* Capacity by route */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Capacity by Route (kg)</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Route</TableHead><TableHead className="text-right">kg</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(supply?.capacityByRoute ?? []).map((r, i) => (
                    <TableRow key={i}><TableCell className="text-xs">{r.originRegion} → {r.destinationRegion}</TableCell><TableCell className="text-right text-xs font-mono">{r.availableKg}</TableCell></TableRow>
                  ))}
                  {!supply?.capacityByRoute?.length && <TableRow><TableCell colSpan={2} className="text-center text-xs text-muted-foreground py-4">No active capacity</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* KYC status of travelers */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Travelers by KYC Status</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(supply?.travelersByKycStatus ?? []).map((k, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <Badge variant={k.status === "VERIFIED" ? "success" : k.status === "PENDING_REVIEW" ? "warning" : "outline"}>{k.status}</Badge>
                  <span className="font-bold">{k.count}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Reliability tiers */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Traveler Reliability Tiers</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(supply?.reliabilityTiers ?? []).map((t, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <Badge variant={t.tier === "TRUSTED" ? "success" : t.tier === "FLAGGED" ? "warning" : t.tier === "SUSPENDED" ? "destructive" : "outline"}>{t.tier}</Badge>
                  <span className="font-bold">{t.travelers}</span>
                </div>
              ))}
              {!supply?.reliabilityTiers?.length && <p className="text-xs text-muted-foreground">No reliability data yet</p>}
            </CardContent>
          </Card>
        </div>
      </Section>

      {/* ── Demand ── */}
      <Section title="Demand">
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 mb-4">
          <Stat label="Open Receiver Requests" value={demand?.receiverRequests?.open ?? 0} sub="Pending fulfillment" />
          <Stat label="Offered" value={demand?.receiverRequests?.offered ?? 0} sub="Traveler responded" />
          <Stat label="Fulfilled" value={demand?.receiverRequests?.fulfilled ?? 0} sub="Completed requests" />
          <Stat label="Unmet Routes" value={demand?.unmetRoutes?.length ?? 0} sub="No carrier found" />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Top Searched Routes</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Route</TableHead><TableHead className="text-right">Searches</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(demand?.topSearchedRoutes ?? []).map((r, i) => (
                    <TableRow key={i}><TableCell className="text-xs">{r.originRegion} → {r.destinationRegion}</TableCell><TableCell className="text-right text-xs font-mono">{r.count}</TableCell></TableRow>
                  ))}
                  {!demand?.topSearchedRoutes?.length && <TableRow><TableCell colSpan={2} className="text-center text-xs text-muted-foreground py-4">No searches yet</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Unmet Demand (No Carrier)</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Route</TableHead><TableHead className="text-right">Count</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(demand?.unmetRoutes ?? []).map((r, i) => (
                    <TableRow key={i}><TableCell className="text-xs">{r.originRegion} → {r.destinationRegion}</TableCell><TableCell className="text-right text-xs font-mono text-orange-600">{r.count}</TableCell></TableRow>
                  ))}
                  {!demand?.unmetRoutes?.length && <TableRow><TableCell colSpan={2} className="text-center text-xs text-muted-foreground py-4">No unmet demand</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Top Item Categories Shipped</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Category</TableHead><TableHead className="text-right">Shipments</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(demand?.topCategories ?? []).map((c, i) => (
                    <TableRow key={i}><TableCell className="text-xs">{c.category}</TableCell><TableCell className="text-right text-xs font-mono">{c.shipments}</TableCell></TableRow>
                  ))}
                  {!demand?.topCategories?.length && <TableRow><TableCell colSpan={2} className="text-center text-xs text-muted-foreground py-4">No items yet</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </Section>

      {/* ── Routes ── */}
      <Section title="Route Performance">
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Route</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Completed</TableHead>
                  <TableHead className="text-right">Completion %</TableHead>
                  <TableHead className="text-right">Avg Price (ETB)</TableHead>
                  <TableHead className="text-right">Revenue (ETB)</TableHead>
                  <TableHead>Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(routes?.routes ?? []).map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs font-medium">{r.originRegion} → {r.destinationRegion}</TableCell>
                    <TableCell className="text-right text-xs">{r.total}</TableCell>
                    <TableCell className="text-right text-xs">{r.completed}</TableCell>
                    <TableCell className="text-right text-xs">
                      <Badge variant={r.completionRate >= 80 ? "success" : r.completionRate >= 50 ? "warning" : "destructive"}>{r.completionRate}%</Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs font-mono">{r.avgPriceEtb.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-xs font-mono">{r.totalRevenueEtb.toLocaleString()}</TableCell>
                    <TableCell><Badge variant={r.international ? "info" : "outline"}>{r.international ? "Intl" : "Domestic"}</Badge></TableCell>
                  </TableRow>
                ))}
                {!routes?.routes?.length && <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">No shipments yet</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Section>

      {/* ── Customs ── */}
      <Section title="Customs Intelligence">
        <div className="grid gap-4 sm:grid-cols-3 mb-4">
          {(customs?.ruleFlags ?? []).map((f, i) => (
            <Stat key={i} label={`Rules: ${f.result}`} value={f.count} />
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Customs Outcomes by Category</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Category</TableHead><TableHead>Outcome</TableHead><TableHead className="text-right">Count</TableHead><TableHead className="text-right">Tax (ETB)</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(customs?.outcomes ?? []).map((o, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs">{o.category}</TableCell>
                      <TableCell><Badge variant={o.outcome === "SEIZED" ? "destructive" : o.outcome === "TAXED" ? "warning" : o.outcome === "FLAGGED" ? "warning" : "success"}>{o.outcome}</Badge></TableCell>
                      <TableCell className="text-right text-xs">{o.count}</TableCell>
                      <TableCell className="text-right text-xs font-mono">{o.totalTaxEtb > 0 ? o.totalTaxEtb.toLocaleString() : "—"}</TableCell>
                    </TableRow>
                  ))}
                  {!customs?.outcomes?.length && <TableRow><TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-4">No customs events recorded</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Tax Collected by Category (ETB)</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Category</TableHead><TableHead className="text-right">Events</TableHead><TableHead className="text-right">Total Tax (ETB)</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(customs?.taxedByCategory ?? []).map((t, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs">{t.category}</TableCell>
                      <TableCell className="text-right text-xs">{t.events}</TableCell>
                      <TableCell className="text-right text-xs font-mono font-semibold">{t.totalTaxEtb.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                  {!customs?.taxedByCategory?.length && <TableRow><TableCell colSpan={3} className="text-center text-xs text-muted-foreground py-4">No tax events yet</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Recent customs events */}
        <div className="mt-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Recent Customs Events</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Category</TableHead><TableHead>Route</TableHead><TableHead>Outcome</TableHead><TableHead className="text-right">Tax (ETB)</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(customs?.recentEvents ?? []).map((e, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs">{e.itemCategory}</TableCell>
                      <TableCell className="text-xs">{e.originRegion} → {e.destinationRegion}</TableCell>
                      <TableCell><Badge variant={e.outcome === "SEIZED" ? "destructive" : e.outcome === "TAXED" || e.outcome === "FLAGGED" ? "warning" : "success"}>{e.outcome}</Badge></TableCell>
                      <TableCell className="text-right text-xs font-mono">{e.taxAmountEtb ? e.taxAmountEtb.toLocaleString() : "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(e.createdAt).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                  {!customs?.recentEvents?.length && <TableRow><TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-4">No events yet</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </Section>

      {/* ── Pricing ── */}
      <Section title="Pricing & Revenue">
        {pricing && (
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 mb-4">
            <Stat label="Total Revenue (ETB)" value={pricing.feeBreakdown.grandTotalEtb.toLocaleString()} />
            <Stat label="Carrier Fees (ETB)" value={pricing.feeBreakdown.totalCarrierEtb.toLocaleString()} />
            <Stat label="Aggregator Fees (ETB)" value={pricing.feeBreakdown.totalAggregatorEtb.toLocaleString()} />
            <Stat label="Platform Fees (ETB)" value={pricing.feeBreakdown.totalPlatformEtb.toLocaleString()} />
            <Stat label="Insurance (ETB)" value={pricing.feeBreakdown.totalInsuranceEtb.toLocaleString()} />
            <Stat label="Tax Collected (ETB)" value={pricing.feeBreakdown.totalTaxEtb.toLocaleString()} />
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Revenue by Category</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Category</TableHead><TableHead className="text-right">Shipments</TableHead><TableHead className="text-right">Avg (ETB)</TableHead><TableHead className="text-right">Total (ETB)</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(pricing?.revenueByCategory ?? []).map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs">{r.category}</TableCell>
                      <TableCell className="text-right text-xs">{r.shipments}</TableCell>
                      <TableCell className="text-right text-xs font-mono">{r.avgEtb.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-xs font-mono font-semibold">{r.totalEtb.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                  {!pricing?.revenueByCategory?.length && <TableRow><TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-4">No revenue data</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Corridor Rates</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Route</TableHead><TableHead className="text-right">Rate/kg</TableHead><TableHead className="text-right">Min</TableHead><TableHead className="text-right">Commission</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(pricing?.corridors ?? []).map((c, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs">{c.originRegion} → {c.destinationRegion}</TableCell>
                      <TableCell className="text-right text-xs font-mono">{c.ratePerKgEtb}</TableCell>
                      <TableCell className="text-right text-xs font-mono">{c.minChargeEtb}</TableCell>
                      <TableCell className="text-right text-xs">{(c.platformCommissionRate * 100).toFixed(0)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Per-item pricing tiers */}
        {(pricing?.pricingTiers?.length ?? 0) > 0 && (
          <div className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Per-Item Pricing Tiers</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead>Corridor</TableHead>
                      <TableHead>Basis</TableHead>
                      <TableHead className="text-right">Multiplier</TableHead>
                      <TableHead className="text-right">Flat Fee (ETB)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(pricing?.pricingTiers ?? []).map((t, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs font-medium">{t.itemCategory}</TableCell>
                        <TableCell className="text-xs">{t.corridorCode ?? "All"}</TableCell>
                        <TableCell><Badge variant="info">{t.pricingBasis}</Badge></TableCell>
                        <TableCell className="text-right text-xs font-mono">{t.rateMultiplier}×</TableCell>
                        <TableCell className="text-right text-xs font-mono">{t.flatFeeEtb > 0 ? t.flatFeeEtb : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}
      </Section>
    </main>
  );
}
