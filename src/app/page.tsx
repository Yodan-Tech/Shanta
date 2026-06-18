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

      <main className="flex flex-1 flex-col items-center justify-center px-4 sm:px-6 py-8 sm:py-12 text-center">
        <div className="w-full max-w-lg">
          <p className="mb-3 sm:mb-4 text-xs sm:text-sm font-semibold uppercase tracking-widest text-amber-600">
            {tb("tagline")}
          </p>
          <h1 className="text-2xl sm:text-4xl font-bold leading-tight tracking-tight text-foreground">
            {t("headline")}
          </h1>
          <p className="mx-auto mt-4 sm:mt-5 text-sm sm:text-base text-muted">
            {t("subhead")}
          </p>

          {/* Two Big Action Buttons */}
          <div className="mt-8 sm:mt-12 flex flex-col gap-3 sm:gap-4">
            <Link href="/send" className="w-full">
              <Button size="lg" className="w-full h-14 sm:h-16 text-base sm:text-lg font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-navy-900">
                {t("landingSendPackage")}
              </Button>
            </Link>
            <Link href="/login?next=/trips/new" className="w-full">
              <Button
                size="lg"
                variant="outline"
                className="w-full h-14 sm:h-16 text-base sm:text-lg font-semibold rounded-lg border-2 border-primary text-primary hover:bg-surface"
              >
                {t("landingCarryPackage")}
              </Button>
            </Link>
          </div>
          <p className="mt-8 sm:mt-10 text-xs sm:text-sm text-muted">
            {t("hubLoginHint")}
          </p>
        </div>
      </main>

      <footer className="px-4 sm:px-6 py-4 sm:py-6 text-center text-xs text-muted border-t border-border">
        {tb("promise")}
      </footer>
    </div>
  );
}
