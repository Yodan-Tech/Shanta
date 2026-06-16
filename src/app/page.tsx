import Link from "next/link";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Button } from "@/components/ui/button";

/**
 * Landing page — action-first entry. Two big buttons drive the happy path:
 * "Send a Package" and "I'm Traveling with Space." No role selection upfront —
 * the button click IS the role choice. Hub operators access via the footer link.
 */
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

          {/* Two primary actions */}
          <div className="mt-12 flex flex-col gap-4 sm:flex-row max-w-xl mx-auto">
            <Link href="/login?action=send" className="flex-1">
              <Button
                size="lg"
                className="w-full h-16 text-lg font-semibold rounded-lg"
              >
                {t("sendPackage")}
              </Button>
            </Link>
            <Link href="/login?action=travel" className="flex-1">
              <Button
                size="lg"
                variant="outline"
                className="w-full h-16 text-lg font-semibold rounded-lg border-2"
              >
                {t("travelWithSpace")}
              </Button>
            </Link>
          </div>

          {/* Hub operator entry — subtle, not primary */}
          <div className="mt-10 text-center">
            <p className="text-sm text-muted">{t("hubLoginHint")}</p>
            <Link
              href="/hub/login"
              className="mt-1 inline-block text-sm font-medium text-navy hover:underline"
            >
              {t("hubLogin")} →
            </Link>
          </div>
        </div>
      </main>

      <footer className="border-t border-border px-6 py-6 text-center text-xs text-muted">
        {tb("promise")}
      </footer>
    </div>
  );
}
