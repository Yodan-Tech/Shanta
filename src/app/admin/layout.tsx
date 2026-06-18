/**
 * Admin area layout — wraps all /admin/* pages except the root dashboard.
 * The root /admin/page.tsx renders its own sidebar. Sub-pages get the shared
 * back-to-dashboard breadcrumb and consistent max-width wrapper.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Shared sub-page header */}
      <div className="border-b bg-muted/30 px-6 py-3 flex items-center gap-4">
        <a href="/admin" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← Dashboard
        </a>
        <nav className="flex items-center gap-3 text-sm overflow-x-auto">
          <a href="/admin/shipments" className="hover:underline whitespace-nowrap">Shipments</a>
          <span className="text-muted-foreground">·</span>
          <a href="/admin/disputes" className="hover:underline whitespace-nowrap">Disputes</a>
          <span className="text-muted-foreground">·</span>
          <a href="/admin/kyc" className="hover:underline whitespace-nowrap">KYC</a>
          <span className="text-muted-foreground">·</span>
          <a href="/admin/escrow" className="hover:underline whitespace-nowrap">Escrow</a>
          <span className="text-muted-foreground">·</span>
          <a href="/admin/users" className="hover:underline whitespace-nowrap">Users</a>
          <span className="text-muted-foreground">·</span>
          <a href="/admin/intelligence" className="hover:underline whitespace-nowrap font-medium">Intelligence</a>
          <span className="text-muted-foreground">·</span>
          <a href="/admin/receiver-requests" className="hover:underline whitespace-nowrap">Requests</a>
          <span className="text-muted-foreground">·</span>
          <a href="/admin/reliability" className="hover:underline whitespace-nowrap">Reliability</a>
          <span className="text-muted-foreground">·</span>
          <a href="/admin/rules" className="hover:underline whitespace-nowrap">Rules</a>
          <span className="text-muted-foreground">·</span>
          <a href="/admin/audit" className="hover:underline whitespace-nowrap">Audit</a>
        </nav>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}
