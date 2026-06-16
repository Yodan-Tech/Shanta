import { requireAdmin } from "@/lib/auth";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorId: string;
  actorType: string;
  createdAt: string;
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ entityType?: string; entityId?: string; page?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;

  const url = new URL(
    `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/v1/admin/audit`,
  );
  if (sp.entityType) url.searchParams.set("entityType", sp.entityType);
  if (sp.entityId) url.searchParams.set("entityId", sp.entityId);
  url.searchParams.set("page", sp.page ?? "1");

  let items: AuditEntry[] = [];
  let total = 0;
  try {
    const res = await fetch(url.toString(), { next: { revalidate: 0 } });
    if (res.ok) {
      const data = (await res.json()) as { data: { items: AuditEntry[]; total: number } };
      items = data.data.items;
      total = data.data.total;
    }
  } catch {
    // handled below
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">Audit Log</h1>
        <span className="text-sm text-muted-foreground">{total} entries</span>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Entity</TableHead>
            <TableHead>Actor</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((e) => (
            <TableRow key={e.id}>
              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                {new Date(e.createdAt).toLocaleString()}
              </TableCell>
              <TableCell className="font-mono text-xs">{e.action}</TableCell>
              <TableCell>
                <div className="text-xs">
                  <span className="font-medium">{e.entityType}</span>
                  <span className="ml-1 text-muted-foreground">
                    {e.entityId.slice(0, 8)}…
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-xs">
                <span className="text-muted-foreground">{e.actorType}</span>{" "}
                {e.actorId.slice(0, 8)}…
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {items.length === 0 && (
        <p className="mt-8 text-center text-sm text-muted-foreground">No audit entries yet.</p>
      )}
    </main>
  );
}
