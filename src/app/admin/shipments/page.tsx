import { requireAdmin } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUS_VARIANT: Record<string, "default" | "success" | "warning" | "destructive" | "info" | "outline"> = {
  COMPLETED: "success",
  ESCROW_RELEASED: "success",
  DISPUTED: "destructive",
  CANCELLED: "outline",
  WEIGHT_DISCREPANCY: "warning",
  AWAITING_HUB_INTAKE: "info",
  AT_ORIGIN_HUB: "info",
  IN_TRANSIT: "info",
  DELIVERED: "info",
};

interface Shipment {
  id: string;
  status: string;
  senderId: string;
  originRegion: string;
  destinationRegion: string;
  createdAt: string;
}

export default async function AdminShipmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const status = sp.status ?? "";
  const page = Number(sp.page ?? 1);

  const url = new URL(
    `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/v1/admin/shipments`,
  );
  if (status) url.searchParams.set("status", status);
  url.searchParams.set("page", String(page));

  let items: Shipment[] = [];
  let total = 0;
  try {
    const res = await fetch(url.toString(), { next: { revalidate: 0 } });
    if (res.ok) {
      const data = (await res.json()) as { data: { items: Shipment[]; total: number } };
      items = data.data.items;
      total = data.data.total;
    }
  } catch {
    // handled below
  }

  return (
    <div className="flex min-h-screen flex-col">
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-bold">Shipments</h1>
          <span className="text-sm text-muted-foreground">{total} total</span>
        </div>

        {/* Status filter */}
        <div className="mb-4 flex flex-wrap gap-2">
          {["", "DISPUTED", "WEIGHT_DISCREPANCY", "AWAITING_HUB_INTAKE", "COMPLETED"].map(
            (s) => (
              <a
                key={s}
                href={`/admin/shipments${s ? `?status=${s}` : ""}`}
                className={`rounded-full border px-3 py-1 text-xs ${status === s ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >
                {s || "All"}
              </a>
            ),
          )}
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Route</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-mono text-xs">{s.id.slice(0, 8)}…</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[s.status] ?? "secondary"}>
                    {s.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">
                  {s.originRegion} → {s.destinationRegion}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(s.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <a
                    href={`/admin/shipments/${s.id}`}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    View
                  </a>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {items.length === 0 && (
          <p className="mt-8 text-center text-sm text-muted-foreground">No shipments found.</p>
        )}
      </main>
    </div>
  );
}
