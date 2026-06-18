import { requireAdmin } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { ReliabilityReport } from "@/lib/services/analytics-service";

export default async function TravelerReliabilityPage() {
  await requireAdmin();

  let data: ReliabilityReport | null = null;
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/v1/admin/intelligence/reliability`,
      { next: { revalidate: 60 } },
    );
    if (res.ok) {
      const json = (await res.json()) as { data: ReliabilityReport };
      data = json.data;
    }
  } catch { /* handled */ }

  function tierVariant(tier: string) {
    if (tier === "TRUSTED") return "success";
    if (tier === "FLAGGED") return "warning";
    if (tier === "SUSPENDED") return "destructive";
    return "outline";
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-8">
      <div className="mb-2">
        <h1 className="text-xl font-bold">Traveler Reliability</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ops-internal trust metrics — never shown to travelers or used as public ranking (Constraint 2.1)
        </p>
      </div>

      {/* Overview stats */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-5 mt-6 mb-6">
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tracked</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{data?.overallStats.totalTracked ?? 0}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Avg Score</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{data?.overallStats.avgScore ?? "—"}</p></CardContent>
        </Card>
        <Card className="border-green-300">
          <CardHeader className="pb-1"><CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Trusted</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-green-700">{data?.overallStats.trustedCount ?? 0}</p></CardContent>
        </Card>
        <Card className="border-orange-300">
          <CardHeader className="pb-1"><CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Flagged</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-orange-600">{data?.overallStats.flaggedCount ?? 0}</p></CardContent>
        </Card>
        <Card className="border-red-300">
          <CardHeader className="pb-1"><CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Suspended</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-red-700">{data?.overallStats.suspendedCount ?? 0}</p></CardContent>
        </Card>
      </div>

      {/* Tier breakdown */}
      <div className="grid gap-4 sm:grid-cols-2 mb-8">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">By Tier</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {(data?.byTier ?? []).map((t, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant={tierVariant(t.tier) as never}>{t.tier}</Badge>
                  <span className="text-xs text-muted-foreground">avg score: {t.avgScore}</span>
                </div>
                <span className="font-bold text-sm">{t.count}</span>
              </div>
            ))}
            {!data?.byTier?.length && <p className="text-xs text-muted-foreground">No reliability data yet. Data populates as shipments are completed.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">How Scores Work</CardTitle></CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-1">
            <p><strong>Score 1.0</strong> = Perfect record</p>
            <p><strong>Score 0.8+</strong> = TRUSTED tier</p>
            <p><strong>Score below 0.5</strong> = FLAGGED</p>
            <p><strong>Dispute rate</strong> = disputes ÷ completed deliveries</p>
            <p><strong>Penalised for:</strong> disputes, no-shows, late handoffs, seal tampering, weight discrepancies</p>
            <p className="mt-2 pt-2 border-t"><strong>NOT tracked:</strong> trip frequency (that's Constraint 2.1 customs risk — separate model)</p>
          </CardContent>
        </Card>
      </div>

      {/* Flagged/Suspended table */}
      {(data?.flaggedTravelers?.length ?? 0) > 0 && (
        <div>
          <h2 className="text-base font-semibold mb-3">Flagged & Suspended Travelers</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Traveler ID</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead className="text-right">Completed</TableHead>
                <TableHead className="text-right">Disputes</TableHead>
                <TableHead className="text-right">No-Shows</TableHead>
                <TableHead className="text-right">Seal Tampers</TableHead>
                <TableHead className="text-right">Dispute Rate</TableHead>
                <TableHead>Flag Reason</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.flaggedTravelers.map((t, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono text-xs">{t.travelerId.slice(0, 8)}…</TableCell>
                  <TableCell><Badge variant={tierVariant(t.reliabilityTier) as never}>{t.reliabilityTier}</Badge></TableCell>
                  <TableCell className="text-right text-xs font-mono font-bold">{t.reliabilityScore}</TableCell>
                  <TableCell className="text-right text-xs">{t.completedDeliveries}</TableCell>
                  <TableCell className="text-right text-xs text-destructive">{t.disputedDeliveries}</TableCell>
                  <TableCell className="text-right text-xs">{t.noShowCount}</TableCell>
                  <TableCell className="text-right text-xs">{t.sealTamperCount}</TableCell>
                  <TableCell className="text-right text-xs">{(t.disputeRate * 100).toFixed(0)}%</TableCell>
                  <TableCell className="text-xs max-w-[200px] truncate">{t.flagReason ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(t.lastUpdatedAt).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {!data?.flaggedTravelers?.length && (data?.overallStats.totalTracked ?? 0) > 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            ✓ No flagged or suspended travelers. All tracked travelers are in good standing.
          </CardContent>
        </Card>
      )}
    </main>
  );
}
