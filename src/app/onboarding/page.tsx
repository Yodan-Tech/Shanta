"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function OnboardingPage() {
  const t = useTranslations("onboarding");
  const router = useRouter();
  const searchParams = useSearchParams();
  const action = searchParams.get("action"); // 'send' or 'travel'

  // If an action was passed, go directly to dashboard
  if (action === "send" || action === "travel") {
    router.replace(`/dashboard?action=${action}`);
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border sm:border-0">
        <Logo />
        <LocaleSwitcher />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 sm:px-6 py-6 sm:py-12">
        <Card className="w-full max-w-sm">
          <CardHeader className="pb-4 sm:pb-6">
            <CardTitle className="text-xl sm:text-2xl">{t("title")}</CardTitle>
            <CardDescription className="text-sm sm:text-base mt-2">{t("subtitle")}</CardDescription>
          </CardHeader>
          <div className="space-y-3 px-6 pb-6">
            <button
              onClick={() => router.push("/dashboard?action=send")}
              className="w-full block p-4 sm:p-5 rounded-[var(--radius)] border border-border hover:bg-surface hover:border-primary transition-all text-left"
            >
              <div className="font-semibold text-foreground text-base sm:text-lg">{t("sendTitle")}</div>
              <div className="text-xs sm:text-sm text-muted mt-2">{t("sendDesc")}</div>
            </button>
            <button
              onClick={() => router.push("/dashboard?action=travel")}
              className="w-full block p-4 sm:p-5 rounded-[var(--radius)] border border-border hover:bg-surface hover:border-primary transition-all text-left"
            >
              <div className="font-semibold text-foreground text-base sm:text-lg">{t("travelTitle")}</div>
              <div className="text-xs sm:text-sm text-muted mt-2">{t("travelDesc")}</div>
            </button>
          </div>
        </Card>
      </main>
    </div>
  );
}
