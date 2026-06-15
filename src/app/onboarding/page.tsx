import { useTranslations } from "next-intl";
import { requireProfile } from "@/lib/auth";
import { saveRoles } from "@/lib/actions";
import { Logo } from "@/components/logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const ROLE_OPTIONS = [
  { value: "SENDER", labelKey: "sender", descKey: "senderDesc" },
  { value: "TRAVELER", labelKey: "traveler", descKey: "travelerDesc" },
  { value: "AGGREGATOR", labelKey: "aggregator", descKey: "aggregatorDesc" },
] as const;

function RoleOptions() {
  const t = useTranslations("onboarding");
  return (
    <fieldset className="space-y-3">
      {ROLE_OPTIONS.map((opt) => (
        <label
          key={opt.value}
          className="flex cursor-pointer items-start gap-3 rounded-[var(--radius)] border border-border p-4 hover:bg-surface"
        >
          <input
            type="checkbox"
            name="roles"
            value={opt.value}
            className="mt-1 h-4 w-4 accent-[var(--color-navy)]"
          />
          <span>
            <span className="block font-semibold text-foreground">
              {t(opt.labelKey)}
            </span>
            <span className="block text-sm text-muted">{t(opt.descKey)}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

export default async function OnboardingPage() {
  await requireProfile();
  return <OnboardingView />;
}

function OnboardingView() {
  const t = useTranslations("onboarding");
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-4">
        <Logo />
        <LocaleSwitcher />
      </header>
      <main className="flex flex-1 items-center justify-center px-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{t("title")}</CardTitle>
            <CardDescription>{t("subtitle")}</CardDescription>
          </CardHeader>
          <form action={saveRoles} className="space-y-5">
            <RoleOptions />
            <Button type="submit" className="w-full">
              {t("save")}
            </Button>
          </form>
        </Card>
      </main>
    </div>
  );
}
