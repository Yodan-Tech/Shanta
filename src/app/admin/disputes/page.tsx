import { requireAdmin } from "@/lib/auth";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Dispute {
  id: string;
  status: string;
  originRegion: string;
  destinationRegion: string;
  updatedAt: string;
  escrow?: { status: string; amountEtb: string } | null;
}

export default async function AdminDisputesPage() {
  await requireAdmin();

  let items: Dispute[] = [];
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/v1/admin/disputes`,
      { next: { revalidate: 0 } },
    );
    if (res.ok) {
      const data = (await res.json()) as { data: { items: Dispute[] } };
      items = data.data.items;
    }
  } catch {
    // handled below
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">Disputes</h1>
        <Badge variant={items.length > 0 ? "destructive" : "success"}>
          {items.length} open
        </Badge>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No open disputes.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Shipment ID</TableHead>
              <TableHead>Route</TableHead>
              <TableHead>Escrow</TableHead>
              <TableHead>Last Updated</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-mono text-xs">{d.id.slice(0, 8)}…</TableCell>
                <TableCell>
                  {d.originRegion} → {d.destinationRegion}
                </TableCell>
                <TableCell>
                  {d.escrow ? (
                    <span className="text-sm">
                      <Badge variant="warning">{d.escrow.status}</Badge>{" "}
                      <span className="text-xs text-muted-foreground">
                        ETB {d.escrow.amountEtb}
                      </span>
                    </span>
                  ) : (
                    "No escrow"
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(d.updatedAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <a
                    href={`/admin/shipments/${d.id}`}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    View evidence chain
                  </a>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
