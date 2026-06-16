import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function AdminPage() {
  // Redirects non-staff to "/". Staff identity comes from the admin_users table.
  const admin = await requireAdmin();
  const t = await getTranslations("admin");

  const adminSections = [
    {
      title: "Shipments",
      description: "Review, transition, and manage shipment states",
      href: "/admin/shipments",
    },
    {
      title: "KYC Queue",
      description: "Review and approve user identity documents",
      href: "/admin/kyc",
    },
    {
      title: "Hub Management",
      description: "Approve, suspend, and manage hub operators",
      href: "/admin/hubs",
    },
    {
      title: "Item Restrictions",
      description: "Define and manage prohibited and restricted items",
      href: "/admin/rules",
    },
    {
      title: "Escrow Holds",
      description: "Review and release escrow holds for transactions",
      href: "/admin/escrow",
    },
    {
      title: "Audit Logs",
      description: "View system-wide transaction and user activity",
      href: "/admin/logs",
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-foreground">{t("title")}</h1>
          <p className="mt-2 text-sm text-muted">
            {admin.email} · {admin.role}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {adminSections.map((section) => (
            <a
              key={section.href}
              href={section.href}
              className="group"
            >
              <Card className="h-full hover:shadow-md transition-shadow cursor-pointer border-border hover:border-primary">
                <CardHeader>
                  <CardTitle className="text-base text-primary group-hover:text-navy-900 transition-colors">
                    {section.title}
                  </CardTitle>
                  <CardDescription className="text-sm">
                    {section.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            </a>
          ))}
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">System Status</CardTitle>
            </CardHeader>
            <div className="px-6 pb-6 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Database</span>
                <span className="font-semibold text-success">Connected</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">SMS Gateway</span>
                <span className="font-semibold text-success">Active</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Email Service</span>
                <span className="font-semibold text-success">Ready</span>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Stats</CardTitle>
            </CardHeader>
            <div className="px-6 pb-6 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Pending KYC</span>
                <span className="font-semibold text-amber">12</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Active Shipments</span>
                <span className="font-semibold">47</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Hub Operators</span>
                <span className="font-semibold">8</span>
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
