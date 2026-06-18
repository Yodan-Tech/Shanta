"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface PreviewRoute {
  code: string;
  originRegion: string;
  destinationRegion: string;
  international: boolean;
  currency: string;
  customsIntelligence: boolean;
  allowAggregationOnly: boolean;
}

interface PreviewLeg {
  originRegion: string;
  destinationRegion: string;
  activeLegs: number;
  capacityKg: number;
}

interface PreviewSignal {
  originRegion: string;
  destinationRegion: string;
  searches: number;
}

interface SendPreviewData {
  routes: PreviewRoute[];
  legs: PreviewLeg[];
  signals: PreviewSignal[];
}

const FEATURED_ROUTES = [
  { originRegion: "Addis Ababa", destinationRegion: "Dubai" },
  { originRegion: "Addis Ababa", destinationRegion: "Dire Dawa" },
  { originRegion: "Addis Ababa", destinationRegion: "Hawassa" },
  { originRegion: "Addis Ababa", destinationRegion: "Bahir Dar" },
];

export function SendForm({ previewData }: { previewData: SendPreviewData }) {
  const router = useRouter();
  const [originRegion, setOriginRegion] = useState("Addis Ababa");
  const [destinationRegion, setDestinationRegion] = useState("Dubai");
  const [weightKg, setWeightKg] = useState("1");
  const [category, setCategory] = useState("GENERAL");
  const [description, setDescription] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");

  const routePreview = useMemo(() => {
    const exactRoute = previewData.routes.find(
      (route) =>
        route.originRegion.toLowerCase() === originRegion.toLowerCase() &&
        route.destinationRegion.toLowerCase() === destinationRegion.toLowerCase(),
    );
    const exactLeg = previewData.legs.find(
      (leg) =>
        leg.originRegion.toLowerCase() === originRegion.toLowerCase() &&
        leg.destinationRegion.toLowerCase() === destinationRegion.toLowerCase(),
    );
    const exactSignal = previewData.signals.find(
      (signal) =>
        signal.originRegion.toLowerCase() === originRegion.toLowerCase() &&
        signal.destinationRegion.toLowerCase() === destinationRegion.toLowerCase(),
    );

    return { exactRoute, exactLeg, exactSignal };
  }, [destinationRegion, originRegion, previewData.legs, previewData.routes, previewData.signals]);

  function continueToAuth() {
    const params = new URLSearchParams({
      next: "/shipments/new",
      originRegion,
      destinationRegion,
      weightKg,
      category,
      description,
      receiverName,
      receiverPhone,
    });
    router.push(`/login?${params.toString()}`);
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(20,31,61,0.16),_transparent_36%),linear-gradient(180deg,#f8fafc_0%,#ffffff_58%,#fff9eb_100%)]">
      <header className="flex items-center justify-between border-b border-border/60 bg-white/70 px-4 py-3 backdrop-blur">
        <Logo />
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="hidden sm:inline-flex">
            Preview first
          </Badge>
          <LocaleSwitcher />
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="space-y-6">
          <div className="space-y-3">
            <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">Send flow</Badge>
            <h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-foreground sm:text-5xl">
              See the route before sign-in.
            </h1>
            <p className="max-w-2xl text-base text-muted sm:text-lg">
              Choose origin, destination, and item details first. Then sign in as the last
              step, once you know the corridor has supply.
            </p>
          </div>

          <Card className="border-navy/15 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
            <CardHeader>
              <CardTitle>Trip preview</CardTitle>
              <CardDescription>
                Update the route and watch the live corridor preview change.
              </CardDescription>
            </CardHeader>
            <div className="grid gap-4 px-6 pb-6 sm:grid-cols-2">
              <Field label="Origin" value={originRegion} onChange={setOriginRegion} placeholder="Addis Ababa" />
              <Field label="Destination" value={destinationRegion} onChange={setDestinationRegion} placeholder="Dubai" />
              <Field label="Weight (kg)" value={weightKg} onChange={setWeightKg} placeholder="1.0" type="number" />
              <Field label="Category" value={category} onChange={setCategory} placeholder="GENERAL" />
              <div className="sm:col-span-2">
                <Label htmlFor="description">What are you sending?</Label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the item, packaging, and any special handling."
                  className="mt-1 h-28 w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-base text-foreground outline-none ring-offset-background placeholder:text-muted focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <Field label="Receiver name" value={receiverName} onChange={setReceiverName} placeholder="Optional" />
              <Field label="Receiver phone" value={receiverPhone} onChange={setReceiverPhone} placeholder="+2519XXXXXXXX" />
            </div>
          </Card>

          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Available carriers"
              value={routePreview.exactLeg ? `${routePreview.exactLeg.activeLegs}` : "0"}
              sub={routePreview.exactLeg ? `${routePreview.exactLeg.capacityKg.toFixed(1)}kg free` : "No active legs yet"}
            />
            <StatCard
              label="Searches this route"
              value={routePreview.exactSignal ? `${routePreview.exactSignal.searches}` : "0"}
              sub="Recent demand captured from search and bot queries"
            />
            <StatCard
              label="Route status"
              value={routePreview.exactRoute ? (routePreview.exactRoute.international ? "International" : "Domestic") : "Unconfigured"}
              sub={routePreview.exactRoute ? `${routePreview.exactRoute.currency} pricing` : "No active route config"}
            />
          </div>

          <Card className="border-dashed">
            <CardHeader>
              <CardTitle>Featured corridors</CardTitle>
              <CardDescription>
                Start from a corridor that already has a route configuration or demand signal.
              </CardDescription>
            </CardHeader>
            <div className="flex flex-wrap gap-2 px-6 pb-6">
              {FEATURED_ROUTES.map((route) => (
                <button
                  key={`${route.originRegion}-${route.destinationRegion}`}
                  type="button"
                  onClick={() => {
                    setOriginRegion(route.originRegion);
                    setDestinationRegion(route.destinationRegion);
                  }}
                  className="rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary hover:bg-surface"
                >
                  {route.originRegion} → {route.destinationRegion}
                </button>
              ))}
            </div>
          </Card>
        </section>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Card className="border-amber-200 bg-amber-50/60">
            <CardHeader>
              <CardTitle className="text-lg">What happens next</CardTitle>
              <CardDescription>
                You do the route work first. Sign-in happens only when you confirm the booking.
              </CardDescription>
            </CardHeader>
            <div className="space-y-3 px-6 pb-6 text-sm text-foreground">
              <Step text="Enter origin, destination, and item details" />
              <Step text="Review available carriers on the corridor" />
              <Step text="Sign in with Telegram, email, or phone" />
              <Step text="Confirm and create the shipment" />
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Intent summary</CardTitle>
              <CardDescription>
                The booking context is carried into auth so the login page is not blank.
              </CardDescription>
            </CardHeader>
            <div className="space-y-2 px-6 pb-6 text-sm">
              <SummaryRow label="Route" value={`${originRegion} → ${destinationRegion}`} />
              <SummaryRow label="Weight" value={`${weightKg || "0"} kg`} />
              <SummaryRow label="Category" value={category || "GENERAL"} />
              <SummaryRow label="Pickup" value={receiverName || "Receiver details next"} />
            </div>
          </Card>

          <Button size="lg" className="w-full h-12 text-base font-semibold" onClick={continueToAuth}>
            Continue to sign in
          </Button>

          <p className="text-center text-xs text-muted">
            Telegram is primary. Email and phone are available if Telegram is not an option.
          </p>
        </aside>
      </main>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1"
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <Card className="bg-white/80">
      <CardHeader className="space-y-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
        <p className="text-xs text-muted">{sub}</p>
      </CardHeader>
    </Card>
  );
}

function Step({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-navy text-[10px] font-bold text-white">
        ✓
      </span>
      <span>{text}</span>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 py-2 last:border-b-0">
      <span className="text-muted">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
