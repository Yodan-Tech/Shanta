"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function VerifyForm({ phone }: { phone: string }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      phone,
      token: code.trim(),
      type: "sms",
    });
    setLoading(false);

    if (verifyError) {
      setError(t("errorInvalidCode"));
      return;
    }

    router.push("/onboarding");
    router.refresh();
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{t("otpTitle")}</CardTitle>
        <CardDescription>{t("otpSubtitle", { phone })}</CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <Label htmlFor="code">{t("otpLabel")}</Label>
          <Input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(e) =>
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            required
          />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "…" : t("verify")}
        </Button>
        <div className="flex justify-between text-sm">
          <Link href="/login" className="text-muted hover:text-navy">
            {t("changeNumber")}
          </Link>
        </div>
      </form>
    </Card>
  );
}
