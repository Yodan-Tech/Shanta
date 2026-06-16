import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireProfile } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>;
}) {
  const profile = await requireProfile();
  const { action } = await searchParams;

  const t = await getTranslations("dashboard");

  // If no action is specified, show action chooser
  if (!action || (action !== "send" && action !== "travel")) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <AppHeader />
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 sm:px-6 py-6 sm:py-10">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">{t("welcome")}</h1>
          <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-muted">Pick what you&apos;d like to do today</p>

          <div className="mt-6 sm:mt-8 grid gap-3 sm:gap-4 sm:grid-cols-2">
            <Link href="/dashboard?action=send">
              <Card className="cursor-pointer hover:shadow-md transition-shadow h-full">
                <CardHeader>
                  <CardTitle className="text-base sm:text-lg text-primary">{t("sendPackage")}</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">{t("sendPackageDesc")}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
            <Link href="/dashboard?action=travel">
              <Card className="cursor-pointer hover:shadow-md transition-shadow h-full">
                <CardHeader>
                  <CardTitle className="text-base sm:text-lg text-primary">{t("travelWithSpace")}</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">{t("travelWithSpaceDesc")}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  // Sender dashboard
  if (action === "send") {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <AppHeader />
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-0">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">{t("sendPackage")}</h1>
              <p className="mt-1 text-xs sm:text-sm text-muted">{t("myItems")}</p>
            </div>
            <Link href="/shipments/new">
              <Button className="w-full sm:w-auto bg-accent text-accent-foreground hover:bg-amber-600 h-11 sm:h-auto text-sm sm:text-base">{t("createNew")}</Button>
            </Link>
          </div>

          <div className="mt-6 sm:mt-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg">No shipments yet</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Create your first shipment to get started</CardDescription>
              </CardHeader>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  // Traveler dashboard (default case)
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-0">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">{t("travelWithSpace")}</h1>
            <p className="mt-1 text-xs sm:text-sm text-muted">{t("myTrips")}</p>
          </div>
          <Link href="/trips/new">
            <Button className="w-full sm:w-auto bg-accent text-accent-foreground hover:bg-amber-600 h-11 sm:h-auto text-sm sm:text-base">{t("createNew")}</Button>
          </Link>
        </div>

        <div className="mt-6 sm:mt-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">No trips published yet</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Create a trip to see available packages</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </main>
    </div>
  );
}
