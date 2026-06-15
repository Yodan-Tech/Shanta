import { getTranslations } from "next-intl/server";
import { Role } from "@prisma/client";
import { requireProfile, requireActiveRole } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const ROLE_PANELS: { role: Role; titleKey: string }[] = [
  { role: Role.SENDER, titleKey: "sender" },
  { role: Role.TRAVELER, titleKey: "traveler" },
  { role: Role.AGGREGATOR, titleKey: "aggregator" },
];

export default async function DashboardPage() {
  const profile = await requireProfile();
  requireActiveRole(profile);

  const t = await getTranslations("dashboard");
  const panels = ROLE_PANELS.filter((p) => profile.roles.includes(p.role));

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
        <h1 className="text-2xl font-bold text-navy">{t("welcome")}</h1>
        <p className="mt-1 text-sm text-muted">
          {t("yourRoles")}:{" "}
          {profile.roles.join(", ")}
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {panels.map((p) => (
            <Card key={p.role}>
              <CardHeader>
                <CardTitle>{t(p.titleKey)}</CardTitle>
                <CardDescription>{t("comingSoon")}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
