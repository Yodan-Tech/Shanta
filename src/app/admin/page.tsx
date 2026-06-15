import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminPage() {
  // Redirects non-staff to "/". Staff identity comes from the admin_users table.
  const admin = await requireAdmin();
  const t = await getTranslations("admin");

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
        <h1 className="text-2xl font-bold text-navy">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted">
          {admin.email} · {admin.role}
        </p>
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>{t("restricted")}</CardTitle>
              <CardDescription>
                KYC review, hub approval, disputes, escrow, and rules management
                will be built here in later Phase 1 milestones.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </main>
    </div>
  );
}
