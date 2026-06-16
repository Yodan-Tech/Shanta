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
          <div className="space-y-4">
            <button
              onClick={() => router.push("/dashboard?action=send")}
              className="w-full block p-4 rounded-[var(--radius)] border border-border hover:bg-surface transition-colors text-left"
            >
              <div className="font-semibold text-foreground">{t("sendTitle")}</div>
              <div className="text-sm text-muted mt-1">{t("sendDesc")}</div>
            </button>
            <button
              onClick={() => router.push("/dashboard?action=travel")}
              className="w-full block p-4 rounded-[var(--radius)] border border-border hover:bg-surface transition-colors text-left"
            >
              <div className="font-semibold text-foreground">{t("travelTitle")}</div>
              <div className="text-sm text-muted mt-1">{t("travelDesc")}</div>
            </button>
          </div>
        </Card>
      </main>
    </div>
  );
}
