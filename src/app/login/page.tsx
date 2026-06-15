"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

    router.push(`/verify?phone=${encodeURIComponent(phone)}`);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-4">
        <Logo />
        <LocaleSwitcher />
      </header>
      <main className="flex flex-1 items-center justify-center px-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{t("phoneTitle")}</CardTitle>
            <CardDescription>{t("phoneSubtitle")}</CardDescription>
          </CardHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="phone">{t("phoneLabel")}</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder={t("phonePlaceholder")}
                value={phone}
                onChange={(e) => setPhone(e.target.value.trim())}
                required
              />
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "…" : t("sendCode")}
            </Button>
          </form>
        </Card>
      </main>
    </div>
  );
}
