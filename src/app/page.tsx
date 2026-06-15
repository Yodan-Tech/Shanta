import Link from "next/link";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Button } from "@/components/ui/button";

export default function Home() {
  const t = useTranslations("landing");
  const tb = useTranslations("brand");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-4">
        <Logo />
        <LocaleSwitcher />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="max-w-2xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-amber-600">
            {tb("tagline")}
          </p>
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-navy sm:text-5xl">
            {t("headline")}
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-muted">
            {t("subhead")}
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/login">
              <Button size="lg">{t("getStarted")}</Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline">
                {t("signIn")}
              </Button>
            </Link>
          </div>
        </div>
      </main>

      <footer className="px-6 py-6 text-center text-sm text-muted">
        {tb("promise")}
      </footer>
    </div>
  );
}
