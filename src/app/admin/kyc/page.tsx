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

interface KycItem {
  userId: string;
  phone: string | null;
  fullName: string | null;
  kycStatus: string;
  kycSubmittedAt: string | null;
  idDocumentUrl: string | null;
}

export default async function AdminKycPage() {
  await requireAdmin();

  let items: KycItem[] = [];
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/v1/admin/kyc/queue`,
      { next: { revalidate: 0 } },
    );
    if (res.ok) {
      const data = (await res.json()) as { data: { items: KycItem[] } };
      items = data.data.items;
    }
  } catch {
    // handled below
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">KYC Review Queue</h1>
        <Badge variant={items.length > 0 ? "warning" : "success"}>
          {items.length} pending
        </Badge>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No pending KYC submissions.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>ID Document</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.userId}>
                <TableCell>
                  <div className="font-medium">{item.fullName ?? "—"}</div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {item.userId.slice(0, 8)}…
                  </div>
                </TableCell>
                <TableCell>{item.phone ?? "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {item.kycSubmittedAt
                    ? new Date(item.kycSubmittedAt).toLocaleDateString()
                    : "—"}
                </TableCell>
                <TableCell>
                  {item.idDocumentUrl ? (
                    <a
                      href={item.idDocumentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline"
                    >
                      View document ↗
                    </a>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <form
                      action={`/api/v1/admin/kyc/${item.userId}/approve`}
                      method="POST"
                    >
                      <button
                        type="submit"
                        className="rounded bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-700"
                      >
                        Approve
                      </button>
                    </form>
                    <a
                      href={`/admin/kyc/${item.userId}/reject`}
                      className="rounded border px-3 py-1 text-xs hover:bg-muted"
                    >
                      Reject
                    </a>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
