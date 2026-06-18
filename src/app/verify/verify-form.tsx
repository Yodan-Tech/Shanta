"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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

type Channel = "phone" | "sms" | "email";

export function VerifyForm({
  contact,
  channel,
}: {
  contact: string;
  channel: Channel;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextHref = searchParams.get("next") ?? "/onboarding";
  const destination = useMemo(() => {
    const params = new URLSearchParams();
    for (const key of [
      "originRegion",
      "destinationRegion",
      "weightKg",
      "category",
      "description",
      "receiverName",
      "receiverPhone",
      "departAt",
      "capacityKg",
      "mode",
    ]) {
      const value = searchParams.get(key);
      if (value) params.set(key, value);
    }
    return params.toString();
  }, [searchParams]);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      ...(channel === "email" ? { email: contact } : { phone: contact }),
      token: code.trim(),
      type: channel === "email" ? "email" : "sms",
    });
    setLoading(false);

    if (verifyError) {
      setError("That code is incorrect or has expired. Please try again.");
      return;
    }

    const nextUrl = destination ? `${nextHref}?${destination}` : nextHref;
    router.push(nextUrl);
    router.refresh();
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Enter your code</CardTitle>
        <CardDescription>
          We sent a code to {contact}. This is the last step before booking.
        </CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <Label htmlFor="code">Verification code</Label>
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
          {loading ? "…" : "Verify and continue"}
        </Button>
        <div className="flex justify-between text-sm">
          <Link href="/login" className="text-muted hover:text-primary">
            Change login method
          </Link>
        </div>
      </form>
    </Card>
  );
}
