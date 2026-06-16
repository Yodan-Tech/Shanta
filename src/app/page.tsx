import Link from "next/link";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Button } from "@/components/ui/button";

export default function Home() {
  const t = useTranslations("landing");
  const tb = useTranslations("brand");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between px-6 py-4">
        <Logo />
        <LocaleSwitcher />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="max-w-2xl">
          <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-amber-600">
            {tb("tagline")}
          </p>
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl">
            {t("headline")}
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-muted sm:text-lg">
            {t("subhead")}
          </p>

          {/* Two Big Action Buttons */}
          <div className="mt-12 flex flex-col gap-4 sm:flex-row sm:gap-4 max-w-xl mx-auto">
            <Link href="/login?action=send" className="flex-1">
              <Button size="lg" className="w-full h-16 text-lg font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-navy-900">
                {t("sendPackage")}
              </Button>
            </Link>
            <Link href="/login?action=travel" className="flex-1">
              <Button
                size="lg"
                variant="outline"
                className="w-full h-16 text-lg font-semibold rounded-lg border-2 border-primary text-primary hover:bg-surface"
              >
                {t("travelWithSpace")}
              </Button>
            </Link>
          </div>

          {/* Subtle Hub Login Link */}
          <div className="mt-8 text-center">
            <p className="text-sm text-muted mb-2">{t("hubLoginHint")}</p>
            <Link href="/hub/login" className="text-sm font-medium text-primary hover:underline">
              {t("hubLogin")}
            </Link>
          </div>
        </div>
      </main>

      <footer className="px-6 py-6 text-center text-xs text-muted border-t border-border">
        {tb("promise")}
      </footer>
    </div>
  );
}
