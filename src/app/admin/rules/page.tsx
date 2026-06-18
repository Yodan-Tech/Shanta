import { requireAdmin } from "@/lib/auth";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Rule {
  id: string;
  itemCategory: string;
  corridorCode: string | null;
  maxWeightKg: string | null;
  maxValueEtb: string | null;
  maxUnitsPerTraveler: number | null;
  prohibited: boolean;
  frequencySensitive: boolean;
  requiresDeclaration: boolean;
  requiresSpecialPermit: boolean;
  dutyApplies: boolean;
  dutyNote: string | null;
  direction: string;
  effectiveFrom: string;
  sourceRegulation: string;
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
  } catch { /* handled */ }

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Item Restriction Rules</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configurable customs rules engine (Constraint 2.4). All rules marked as secondary research until OQ-3 is resolved.
          </p>
        </div>
        <span className="text-sm text-muted-foreground">{items.length} active rules</span>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead>Corridor</TableHead>
              <TableHead>Max Weight (kg)</TableHead>
              <TableHead>Max Value (ETB)</TableHead>
              <TableHead>Max Units / Person</TableHead>
              <TableHead>Direction</TableHead>
              <TableHead>Flags</TableHead>
              <TableHead>Duty</TableHead>
              <TableHead>Effective From</TableHead>
              <TableHead>Source</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((rule) => (
              <TableRow key={rule.id}>
                <TableCell className="font-medium text-sm">{rule.itemCategory}</TableCell>
                <TableCell className="text-xs">{rule.corridorCode ?? <span className="text-muted-foreground">All</span>}</TableCell>
                <TableCell className="text-xs font-mono">{rule.maxWeightKg ?? "—"}</TableCell>
                <TableCell className="text-xs font-mono">{rule.maxValueEtb ? Number(rule.maxValueEtb).toLocaleString() : "—"}</TableCell>
                <TableCell className="text-xs font-mono">{rule.maxUnitsPerTraveler ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant="info">{rule.direction}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {rule.prohibited && <Badge variant="destructive">PROHIBITED</Badge>}
                    {rule.frequencySensitive && <Badge variant="warning">FREQ</Badge>}
                    {rule.requiresDeclaration && <Badge variant="outline">DECLARE</Badge>}
                    {rule.requiresSpecialPermit && <Badge variant="outline">PERMIT</Badge>}
                  </div>
                </TableCell>
                <TableCell>
                  {rule.dutyApplies ? (
                    <div>
                      <Badge variant="warning">DUTY</Badge>
                      {rule.dutyNote && <p className="text-xs text-muted-foreground mt-0.5 max-w-[200px]">{rule.dutyNote}</p>}
                    </div>
                  ) : <span className="text-xs text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(rule.effectiveFrom).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">
                  {rule.sourceRegulation}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {items.length === 0 && (
        <p className="mt-8 text-center text-sm text-muted-foreground">
          No active rules. Run <code>pnpm db:seed</code> to add the Constraint 2.4 ruleset.
        </p>
      )}
    </main>
  );
}
