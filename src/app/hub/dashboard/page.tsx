import { useTranslations } from "next-intl";
import { Logo } from "@/components/logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function HubDashboardPage() {
  const th = useTranslations("hub");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <Logo />
        <LocaleSwitcher />
      </header>
      <main className="flex flex-1 items-center justify-center px-6 py-8">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle>{th("dashboardTitle")}</CardTitle>
            <CardDescription>{th("comingSoon")}</CardDescription>
          </CardHeader>
        </Card>
      </main>
    </div>
  );
}
