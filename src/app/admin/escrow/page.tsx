import { requireAdmin } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface EscrowItem {
  id: string;
  amountEtb: string;
  currency: string;
  holderType: string;
  status: string;
  heldAt: string | null;
  releasedAt: string | null;
  refundedAt: string | null;
  createdAt: string;
  shipment: { id: string; status: string; senderId: string } | null;
}

interface EscrowData { items: EscrowItem[]; total: number }

async function fetchEscrow(status?: string): Promise<EscrowData | null> {
  try {
    const url = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/v1/admin/escrow${status ? `?status=${status}` : "?limit=100"}`;
    const res = await fetch(url, { next: { revalidate: 30 } });
    if (!res.ok) return null;
    const json = (await res.json()) as { data: EscrowData };
    return json.data;
  } catch { return null; }
}

function statusColor(s: string) {
  if (s === "HELD") return "warning";
  if (s === "RELEASED") return "success";
  if (s === "REFUNDED") return "info";
  if (s === "DISPUTED") return "destructive";
  return "outline";
}

export default async function AdminEscrowPage() {
  await requireAdmin();

  const [all, held] = await Promise.all([fetchEscrow(), fetchEscrow("HELD")]);

  const totalHeld = (held?.items ?? []).reduce((s, e) => s + Number(e.amountEtb), 0);

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold">Escrow</h1>
        <p className="text-sm text-muted-foreground mt-1">Manual hub escrow ledger</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Records</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{all?.total ?? 0}</p></CardContent>
        </Card>
        <Card className="border-orange-300">
          <CardHeader className="pb-1"><CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Currently HELD</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{held?.total ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{totalHeld.toLocaleString()} ETB total</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Avg Hold (ETB)</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {(held?.total ?? 0) > 0 ? Math.round(totalHeld / (held?.total ?? 1)).toLocaleString() : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Escrow ID</TableHead>
            <TableHead>Shipment</TableHead>
            <TableHead>Amount (ETB)</TableHead>
            <TableHead>Holder</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Held At</TableHead>
            <TableHead>Released / Refunded</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(all?.items ?? []).map((e) => (
            <TableRow key={e.id}>
              <TableCell className="font-mono text-xs">{e.id.slice(0, 8)}…</TableCell>
              <TableCell className="font-mono text-xs">
                {e.shipment ? (
                  <a href={`/admin/shipments?id=${e.shipment.id}`} className="underline">
                    {e.shipment.id.slice(0, 8)}…
                  </a>
                ) : "—"}
              </TableCell>
              <TableCell className="font-mono font-semibold text-sm">{Number(e.amountEtb).toLocaleString()} {e.currency}</TableCell>
              <TableCell className="text-xs">{e.holderType}</TableCell>
              <TableCell><Badge variant={statusColor(e.status) as never}>{e.status}</Badge></TableCell>
              <TableCell className="text-xs text-muted-foreground">{e.heldAt ? new Date(e.heldAt).toLocaleDateString() : "—"}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {e.releasedAt ? `Released ${new Date(e.releasedAt).toLocaleDateString()}` :
                 e.refundedAt ? `Refunded ${new Date(e.refundedAt).toLocaleDateString()}` : "—"}
              </TableCell>
              <TableCell>
                {e.status === "HELD" && (
                  <div className="flex gap-2">
                    <form method="POST" action={`/api/v1/admin/escrow/${e.id}/release`}>
                      <button type="submit" className="text-xs text-success hover:underline">Release</button>
                    </form>
                    <form method="POST" action={`/api/v1/admin/escrow/${e.id}/refund`}>
                      <button type="submit" className="text-xs text-destructive hover:underline">Refund</button>
                    </form>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
          {!all?.items?.length && (
            <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-12">No escrow records.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </main>
  );
}
