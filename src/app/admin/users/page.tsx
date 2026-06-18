import { requireAdmin } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface User {
  id: string;
  phone: string | null;
  email: string | null;
  fullName: string | null;
  roles: string[];
  kycStatus: string;
  status: string;
  createdAt: string;
}

interface UsersData { items: User[]; total: number; page: number }

export default async function AdminUsersPage() {
  await requireAdmin();

  let data: UsersData | null = null;
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/v1/admin/users?limit=100`,
      { next: { revalidate: 30 } },
    );
    if (res.ok) {
      const json = (await res.json()) as { data: UsersData };
      data = json.data;
    }
  } catch { /* handled below */ }

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">Users</h1>
        <span className="text-sm text-muted-foreground">{data?.total ?? 0} total</span>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name / Contact</TableHead>
            <TableHead>Roles</TableHead>
            <TableHead>KYC</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(data?.items ?? []).map((u) => (
            <TableRow key={u.id}>
              <TableCell>
                <p className="font-medium text-sm">{u.fullName ?? "—"}</p>
                <p className="text-xs text-muted-foreground">{u.phone ?? u.email ?? "No contact"}</p>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {u.roles.map((r) => (
                    <Badge key={r} variant="outline" className="text-xs">{r}</Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={u.kycStatus === "VERIFIED" ? "success" : u.kycStatus === "PENDING_REVIEW" ? "warning" : u.kycStatus === "REJECTED" ? "destructive" : "outline"}>
                  {u.kycStatus}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={u.status === "ACTIVE" ? "success" : "destructive"}>{u.status}</Badge>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {new Date(u.createdAt).toLocaleDateString()}
              </TableCell>
              <TableCell>
                <div className="flex gap-2">
                  {u.status === "ACTIVE" && (
                    <form method="POST" action={`/api/v1/admin/users/${u.id}/suspend`}>
                      <button type="submit" className="text-xs text-destructive hover:underline">
                        Suspend
                      </button>
                    </form>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
          {!data?.items?.length && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-12">
                No users yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </main>
  );
}
