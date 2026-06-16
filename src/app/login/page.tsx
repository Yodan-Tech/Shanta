"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { isValidPhone } from "@/lib/validators";
import { Logo } from "@/components/logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function LoginPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const action = searchParams.get("action"); // 'send' or 'travel' passed from landing
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isValidPhone(phone)) {
      setError(t("errorInvalidPhone"));
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: otpError } = await supabase.auth.signInWithOtp({ phone });
    setLoading(false);

    if (otpError) {
      setError(
        otpError.status === 429
          ? t("errorRateLimited")
          : otpError.message,
      );
      return;
    }

    // Preserve action param if it came from landing page
    const verifyUrl = action
      ? `/verify?phone=${encodeURIComponent(phone)}&action=${action}`
      : `/verify?phone=${encodeURIComponent(phone)}`;
    router.push(verifyUrl);
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
            <CardTitle className="text-xl sm:text-2xl">{t("phoneTitle")}</CardTitle>
            <CardDescription className="text-sm sm:text-base mt-2">{t("phoneSubtitle")}</CardDescription>
          </CardHeader>
          <form onSubmit={onSubmit} className="space-y-5 px-6 pb-6">
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm font-medium">{t("phoneLabel")}</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder={t("phonePlaceholder")}
                value={phone}
                onChange={(e) => setPhone(e.target.value.trim())}
                className="h-12 sm:h-11 text-base"
                required
              />
            </div>
            {error && <p className="text-sm text-danger font-medium">{error}</p>}
            <Button type="submit" size="lg" className="w-full h-12 sm:h-11 text-base font-semibold" disabled={loading}>
              {loading ? "…" : t("sendCode")}
            </Button>
          </form>
        </Card>
      </main>
    </div>
  );
}
