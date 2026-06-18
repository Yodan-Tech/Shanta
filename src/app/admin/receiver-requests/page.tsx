import { requireAdmin } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface ReceiverRequest {
  id: string;
  receiverName: string;
  receiverPhone: string;
  originRegion: string;
  destinationRegion: string;
  itemCategory: string;
  itemDescription: string;
  estimatedValueEtb: string | null;
  quantity: number;
  neededBy: string | null;
  status: string;
  offeredByTravelerId: string | null;
  fulfilledAt: string | null;
  createdAt: string;
}

interface RequestData { items: ReceiverRequest[]; total: number }

async function fetchRequests(): Promise<RequestData | null> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/v1/admin/receiver-requests?limit=100`,
      { next: { revalidate: 30 } },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { data: RequestData };
    return json.data;
  } catch { return null; }
}

function statusVariant(s: string) {
  if (s === "OPEN") return "info";
  if (s === "OFFERED") return "warning";
  if (s === "ACCEPTED") return "warning";
  if (s === "FULFILLED") return "success";
  if (s === "CANCELLED" || s === "EXPIRED") return "outline";
  return "outline";
}

export default async function ReceiverRequestsPage() {
  await requireAdmin();
  const data = await fetchRequests();

  const byStatus = (data?.items ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold">Receiver Requests</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Receivers asking travelers to bring items — demand-side intelligence
        </p>
      </div>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-5 mb-6">
        {["OPEN", "OFFERED", "ACCEPTED", "FULFILLED", "EXPIRED"].map((s) => (
          <Card key={s}>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{s}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{byStatus[s] ?? 0}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Receiver</TableHead>
            <TableHead>Route</TableHead>
            <TableHead>Item</TableHead>
            <TableHead>Qty</TableHead>
            <TableHead>Est. Value (ETB)</TableHead>
            <TableHead>Needed By</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(data?.items ?? []).map((r) => (
            <TableRow key={r.id}>
              <TableCell>
                <p className="text-sm font-medium">{r.receiverName}</p>
                <p className="text-xs text-muted-foreground">{r.receiverPhone}</p>
              </TableCell>
              <TableCell className="text-xs">{r.originRegion} → {r.destinationRegion}</TableCell>
              <TableCell>
                <p className="text-xs font-medium">{r.itemCategory}</p>
                <p className="text-xs text-muted-foreground max-w-[160px] truncate">{r.itemDescription}</p>
              </TableCell>
              <TableCell className="text-xs">{r.quantity}</TableCell>
              <TableCell className="text-xs font-mono">
                {r.estimatedValueEtb ? Number(r.estimatedValueEtb).toLocaleString() : "—"}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {r.neededBy ? new Date(r.neededBy).toLocaleDateString() : "—"}
              </TableCell>
              <TableCell>
                <Badge variant={statusVariant(r.status) as never}>{r.status}</Badge>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {new Date(r.createdAt).toLocaleDateString()}
              </TableCell>
            </TableRow>
          ))}
          {!data?.items?.length && (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-12">
                No receiver requests yet. They appear here when receivers submit requests via SMS or the app.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </main>
  );
}
