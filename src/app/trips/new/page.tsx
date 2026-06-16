"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

const MODES = [
  { value: "FLIGHT", label: "Flight" },
  { value: "ROAD", label: "Road" },
  { value: "BUS", label: "Bus" },
  { value: "OTHER", label: "Other" },
];

export default function NewTripPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    mode: "FLIGHT",
    originRegion: "",
    destinationRegion: "",
    departAt: "",
    totalCapacityKg: "",
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/v1/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: form.mode,
          countryCode: "ET",
          legs: [
            {
              sequence: 1,
              originRegion: form.originRegion,
              destinationRegion: form.destinationRegion,
              departAt: new Date(form.departAt).toISOString(),
              totalCapacityKg: parseFloat(form.totalCapacityKg),
            },
          ],
        }),
      });
      const data = (await res.json()) as { data?: { id?: string }; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to create trip.");
        return;
      }
      router.push("/trips");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-lg flex-1 px-6 py-8">
        <h1 className="mb-6 text-xl font-bold">Register your trip</h1>

        <form onSubmit={onSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Trip details</CardTitle>
              <CardDescription>
                You must have identity verification (KYC) to publish a trip.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Transport mode</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {MODES.map((m) => (
                    <label
                      key={m.value}
                      className={`flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm ${
                        form.mode === m.value
                          ? "border-navy bg-navy text-white"
                          : "border-border hover:bg-surface"
                      }`}
                    >
                      <input
                        type="radio"
                        name="mode"
                        value={m.value}
                        checked={form.mode === m.value}
                        onChange={() => setForm((f) => ({ ...f, mode: m.value }))}
                        className="sr-only"
                      />
                      {m.label}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="origin">Departing from</Label>
                <Input
                  id="origin"
                  required
                  placeholder="e.g. Addis Ababa"
                  value={form.originRegion}
                  onChange={(e) => setForm((f) => ({ ...f, originRegion: e.target.value }))}
                />
              </div>

              <div>
                <Label htmlFor="dest">Arriving at</Label>
                <Input
                  id="dest"
                  required
                  placeholder="e.g. Dire Dawa"
                  value={form.destinationRegion}
                  onChange={(e) => setForm((f) => ({ ...f, destinationRegion: e.target.value }))}
                />
              </div>

              <div>
                <Label htmlFor="depart">Departure date and time</Label>
                <Input
                  id="depart"
                  type="datetime-local"
                  required
                  value={form.departAt}
                  onChange={(e) => setForm((f) => ({ ...f, departAt: e.target.value }))}
                />
              </div>

              <div>
                <Label htmlFor="capacity">Available luggage capacity (kg)</Label>
                <Input
                  id="capacity"
                  type="number"
                  required
                  min="0.5"
                  step="0.5"
                  placeholder="10"
                  value={form.totalCapacityKg}
                  onChange={(e) => setForm((f) => ({ ...f, totalCapacityKg: e.target.value }))}
                />
                <p className="mt-1 text-xs text-muted">
                  Be honest — you will carry this weight on your body through customs.
                </p>
              </div>
            </CardContent>
          </Card>

          {error && (
            <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-danger">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Registering trip…" : "Register trip"}
          </Button>
        </form>
      </main>
    </div>
  );
}
