"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { publicEnv } from "@/lib/env";
import { Logo } from "@/components/logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TelegramLoginButton } from "@/components/telegram-login-button";
import { isValidEmail, isValidPhone } from "@/lib/validators";

type Channel = "email" | "phone";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextHref = searchParams.get("next") ?? "/onboarding";
  const originRegion = searchParams.get("originRegion") ?? "";
  const destinationRegion = searchParams.get("destinationRegion") ?? "";
  const weightKg = searchParams.get("weightKg") ?? "";
  const category = searchParams.get("category") ?? "";
  const description = searchParams.get("description") ?? "";
  const receiverName = searchParams.get("receiverName") ?? "";
  const receiverPhone = searchParams.get("receiverPhone") ?? "";
  const intentSummary = useMemo(() => {
    if (!originRegion || !destinationRegion) return null;
    const parts = [`${originRegion} → ${destinationRegion}`];
    if (weightKg) parts.push(`${weightKg} kg`);
    if (category) parts.push(category);
    return `You are one step away from sending ${parts.join(" · ")}.`;
  }, [category, destinationRegion, originRegion, weightKg]);
  const draftQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (originRegion) params.set("originRegion", originRegion);
    if (destinationRegion) params.set("destinationRegion", destinationRegion);
    if (weightKg) params.set("weightKg", weightKg);
    if (category) params.set("category", category);
    if (description) params.set("description", description);
    if (receiverName) params.set("receiverName", receiverName);
    if (receiverPhone) params.set("receiverPhone", receiverPhone);
    return params.toString();
  }, [category, description, destinationRegion, originRegion, receiverName, receiverPhone, weightKg]);

  async function redirectToVerify(channel: Channel, contact: string) {
    const params = new URLSearchParams();
    params.set("channel", channel);
    params.set("contact", contact);
    params.set("next", nextHref);
    if (draftQuery) {
      const draft = new URLSearchParams(draftQuery);
      draft.forEach((value, key) => params.set(key, value));
    }
    router.push(`/verify?${params.toString()}`);
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(20,31,61,0.12),_transparent_38%),linear-gradient(180deg,#f8fafc_0%,#ffffff_60%,#fff8ea_100%)]">
      <header className="flex items-center justify-between border-b border-border/60 bg-white/70 px-4 py-3 backdrop-blur">
        <Logo />
        <LocaleSwitcher />
      </header>

      <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="space-y-6">
          <div className="space-y-3">
            <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">
              Sign in at the end
            </Badge>
            <h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Almost there.
            </h1>
            <p className="max-w-2xl text-base text-muted sm:text-lg">
              We already know your route. Choose the lightest login option that fits you and
              we&apos;ll carry your booking context forward.
            </p>
          </div>

          {intentSummary && (
            <Card className="border-navy/15 bg-navy/5">
              <CardHeader>
                <CardTitle>Booking context</CardTitle>
                <CardDescription>{intentSummary}</CardDescription>
              </CardHeader>
              <div className="grid gap-3 px-6 pb-6 sm:grid-cols-2">
                <MiniStat label="Route" value={`${originRegion} → ${destinationRegion}`} />
                <MiniStat label="Weight" value={`${weightKg || "0"} kg`} />
                <MiniStat label="Category" value={category || "GENERAL"} />
                <MiniStat label="Receiver" value={receiverName || "To be filled"} />
              </div>
            </Card>
          )}

          <TelegramLoginButton
            botUsername={publicEnv.telegramBotUsername}
            nextHref={draftQuery ? `${nextHref}?${draftQuery}` : nextHref}
            intentSummary={intentSummary ?? undefined}
          />

          <Card>
            <CardHeader>
              <CardTitle>Continue with email</CardTitle>
              <CardDescription>
                Good for diaspora users who prefer email over phone OTP.
              </CardDescription>
            </CardHeader>
            <EmailForm onSubmit={async (email) => {
              const supabase = createClient();
              const { error } = await supabase.auth.signInWithOtp({ email });
              if (error) throw error;
              await redirectToVerify("email", email);
            }} />
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Continue with phone</CardTitle>
              <CardDescription>
                Still available, but no longer the first wall.
              </CardDescription>
            </CardHeader>
            <PhoneForm onSubmit={async (phone) => {
              const supabase = createClient();
              const { error } = await supabase.auth.signInWithOtp({ phone });
              if (error) throw error;
              await redirectToVerify("phone", phone);
            }} />
          </Card>
        </section>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle>Why this flow</CardTitle>
              <CardDescription>
                The code now defers auth until after the user sees route context and supply.
              </CardDescription>
            </CardHeader>
            <div className="space-y-3 px-6 pb-6 text-sm text-foreground">
              <Point text="Telegram is primary when available." />
              <Point text="Email is the lightest non-Telegram option." />
              <Point text="Phone remains supported, but only after the booking context is visible." />
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Next step</CardTitle>
              <CardDescription>
                After auth, you land on the booking form with the route and item details already
                prefilled.
              </CardDescription>
            </CardHeader>
            <div className="px-6 pb-6">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => router.push("/send")}
              >
                Back to preview
              </Button>
            </div>
          </Card>
        </aside>
      </main>
    </div>
  );
}

function EmailForm({ onSubmit }: { onSubmit: (email: string) => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-4 px-6 pb-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        if (!isValidEmail(email)) {
          setError("Enter a valid email address.");
          return;
        }
        setLoading(true);
        try {
          await onSubmit(email.trim());
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not send email code.");
        } finally {
          setLoading(false);
        }
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="email">Email address</Label>
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="name@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value.trim())}
          required
        />
      </div>
      {error && <p className="text-sm text-danger font-medium">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Sending..." : "Send email code"}
      </Button>
    </form>
  );
}

function PhoneForm({ onSubmit }: { onSubmit: (phone: string) => Promise<void> }) {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-4 px-6 pb-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        if (!isValidPhone(phone)) {
          setError("Please enter a valid phone number in international format.");
          return;
        }
        setLoading(true);
        try {
          await onSubmit(phone.trim());
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not send phone code.");
        } finally {
          setLoading(false);
        }
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="phone">Phone number</Label>
        <Input
          id="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+2519XXXXXXXX"
          value={phone}
          onChange={(e) => setPhone(e.target.value.trim())}
          required
        />
      </div>
      {error && <p className="text-sm text-danger font-medium">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Sending..." : "Send phone code"}
      </Button>
    </form>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius)] border border-border bg-white px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function Point({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-navy text-[10px] font-bold text-white">
        •
      </span>
      <span>{text}</span>
    </div>
  );
}
