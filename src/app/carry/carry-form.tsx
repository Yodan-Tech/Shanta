"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

const FEATURED_ROUTES = [
  { originRegion: "Addis Ababa", destinationRegion: "Dubai" },
  { originRegion: "Dubai", destinationRegion: "Addis Ababa" },
  { originRegion: "Addis Ababa", destinationRegion: "Dire Dawa" },
  { originRegion: "Addis Ababa", destinationRegion: "Hawassa" },
];

export function CarryForm() {
  const router = useRouter();
  const [originRegion, setOriginRegion] = useState("Dubai");
  const [destinationRegion, setDestinationRegion] = useState("Addis Ababa");
  const [departAt, setDepartAt] = useState("");
  const [capacityKg, setCapacityKg] = useState("5");
  const [mode, setMode] = useState("FLIGHT");

  function continueToAuth() {
    const params = new URLSearchParams({
      next: "/trips/new",
      originRegion,
      destinationRegion,
      departAt,
      capacityKg,
      mode,
    });
    router.push(`/login?${params.toString()}`);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <Logo />
        <LocaleSwitcher />
      </header>

      <main className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-8 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="space-y-6">
          <div className="space-y-3">
            <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">
              Carry flow
            </Badge>
            <h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Carry a package on a trip you already have.
            </h1>
            <p className="max-w-2xl text-base text-muted sm:text-lg">
              Tell Shanta where you are going and how much space you have. Login comes only
              when you publish the trip.
            </p>
          </div>

          <Card className="border-navy/15">
            <CardHeader>
              <CardTitle>Trip space</CardTitle>
              <CardDescription>
                Agents and senders need route, timing, and available luggage space.
              </CardDescription>
            </CardHeader>
            <div className="grid gap-4 px-6 pb-6 sm:grid-cols-2">
              <Field label="Origin" value={originRegion} onChange={setOriginRegion} placeholder="Dubai" />
              <Field label="Destination" value={destinationRegion} onChange={setDestinationRegion} placeholder="Addis Ababa" />
              <Field label="Travel date" value={departAt} onChange={setDepartAt} placeholder="" type="date" />
              <Field label="Space available (kg)" value={capacityKg} onChange={setCapacityKg} placeholder="5" type="number" />
              <div className="sm:col-span-2">
                <Label htmlFor="mode">Travel mode</Label>
                <select
                  id="mode"
                  value={mode}
                  onChange={(event) => setMode(event.target.value)}
                  className="mt-1 h-11 w-full rounded-[var(--radius)] border border-border bg-background px-3 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="FLIGHT">Flight</option>
                  <option value="ROAD">Road</option>
                  <option value="BUS">Bus</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>
          </Card>

          <Card className="border-dashed">
            <CardHeader>
              <CardTitle>Common routes</CardTitle>
              <CardDescription>Pick a route and adjust it if needed.</CardDescription>
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
                  {route.originRegion} to {route.destinationRegion}
                </button>
              ))}
            </div>
          </Card>
        </section>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Card className="border-amber-200 bg-amber-50/60">
            <CardHeader>
              <CardTitle className="text-lg">Publish only when ready</CardTitle>
              <CardDescription>
                Shanta uses your route to match real sender demand. You sign in at the end
                so the first step stays fast.
              </CardDescription>
            </CardHeader>
            <div className="space-y-2 px-6 pb-6 text-sm">
              <SummaryRow label="Route" value={`${originRegion} to ${destinationRegion}`} />
              <SummaryRow label="Date" value={departAt || "Choose date"} />
              <SummaryRow label="Capacity" value={`${capacityKg || "0"} kg`} />
              <SummaryRow label="Mode" value={mode} />
            </div>
          </Card>

          <Button
            size="lg"
            className="h-12 w-full text-base font-semibold"
            onClick={continueToAuth}
            disabled={!originRegion || !destinationRegion || !departAt || !capacityKg}
          >
            Continue to publish trip
          </Button>
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
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-1"
      />
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
