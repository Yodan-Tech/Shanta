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

interface Rule {
  id: string;
  itemCategory: string;
  corridorCode: string | null;
  maxWeightKg: string | null;
  prohibited: boolean;
  frequencySensitive: boolean;
  direction: string;
  effectiveFrom: string;
}

export default async function AdminRulesPage() {
  await requireAdmin();

  let items: Rule[] = [];
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/v1/admin/rules`,
      { next: { revalidate: 60 } },
    );
    if (res.ok) {
      const data = (await res.json()) as { data: { items: Rule[] } };
      items = data.data.items;
    }
  } catch {
    // handled below
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">Item Restriction Rules</h1>
        <span className="text-sm text-muted-foreground">{items.length} active rules</span>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Category</TableHead>
            <TableHead>Corridor</TableHead>
            <TableHead>Max Weight (kg)</TableHead>
            <TableHead>Direction</TableHead>
            <TableHead>Flags</TableHead>
            <TableHead>Effective From</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((rule) => (
            <TableRow key={rule.id}>
              <TableCell className="font-medium">{rule.itemCategory}</TableCell>
              <TableCell>{rule.corridorCode ?? "All corridors"}</TableCell>
              <TableCell>{rule.maxWeightKg ?? "—"}</TableCell>
              <TableCell>
                <Badge variant="info">{rule.direction}</Badge>
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  {rule.prohibited && <Badge variant="destructive">PROHIBITED</Badge>}
                  {rule.frequencySensitive && <Badge variant="warning">FREQ</Badge>}
                </div>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {new Date(rule.effectiveFrom).toLocaleDateString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {items.length === 0 && (
        <p className="mt-8 text-center text-sm text-muted-foreground">
          No active rules. Seed the database to add corridor rules.
        </p>
      )}
    </main>
  );
}
