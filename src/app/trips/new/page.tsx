"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/logo";
import { LocaleSwitcher } from "@/components/locale-switcher";

const ROUTES = [
  { id: "addis-dubai", from: "Addis Ababa", to: "Dubai" },
  { id: "dubai-addis", from: "Dubai", to: "Addis Ababa" },
  { id: "addis-dawa", from: "Addis Ababa", to: "Dire Dawa" },
  { id: "addis-hawassa", from: "Addis Ababa", to: "Hawassa" },
  { id: "addis-bahirdar", from: "Addis Ababa", to: "Bahir Dar" },
  { id: "addis-adama", from: "Addis Ababa", to: "Adama" },
];

const MODES = [
  { value: "FLIGHT", label: "Flight" },
  { value: "ROAD", label: "Road" },
  { value: "BUS", label: "Bus" },
  { value: "OTHER", label: "Other" },
];

export default function CreateTripPage() {
  const t = useTranslations("trips");
  const router = useRouter();
  const searchParams = useSearchParams();
  const draftRoute = ROUTES.find(
    (route) =>
      route.from === searchParams.get("originRegion") &&
      route.to === searchParams.get("destinationRegion"),
  );
  const [formData, setFormData] = useState({
    route: draftRoute?.id ?? "",
    mode: searchParams.get("mode") ?? "ROAD",
    departure: searchParams.get("departAt") ?? "",
    capacity: searchParams.get("capacityKg") ?? "",
    notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const selectedRoute = ROUTES.find((r) => r.id === formData.route);
      if (!selectedRoute || !formData.departure || !formData.capacity) {
        throw new Error("Please fill in all required fields");
      }

      const response = await fetch("/api/v1/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          mode: formData.mode,
          countryCode: "ET",
          legs: [
            {
              sequence: 1,
              originRegion: selectedRoute.from,
              destinationRegion: selectedRoute.to,
              departAt: new Date(formData.departure).toISOString(),
              totalCapacityKg: parseInt(formData.capacity),
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Failed to create trip");
      }

      router.push("/trips");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border">
        <Logo />
        <LocaleSwitcher />
      </header>
      <main className="flex-1 px-4 sm:px-6 py-6 sm:py-8">
        <div className="w-full max-w-2xl mx-auto">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">{t("create")}</h1>
          <p className="text-sm text-muted mb-6 sm:mb-8">{t("details")}</p>

          <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
            {/* Route Selection */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base sm:text-lg">{t("route")}</CardTitle>
              </CardHeader>
              <div className="px-4 sm:px-6 pb-4 sm:pb-6">
                <select
                  value={formData.route}
                  onChange={(e) => setFormData({ ...formData, route: e.target.value })}
                  className="w-full px-3 sm:px-4 py-3 sm:py-2.5 text-base border border-border rounded-[var(--radius)] focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                  required
                >
                  <option value="">Choose your route...</option>
                  {ROUTES.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.from} {"→"} {r.to}
                    </option>
                  ))}
                </select>
              </div>
            </Card>

            {/* Trip Details */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base sm:text-lg">Travel Details</CardTitle>
              </CardHeader>
              <div className="px-4 sm:px-6 pb-4 sm:pb-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="mode" className="text-sm font-medium">Transport Mode</Label>
                  <select
                    id="mode"
                    value={formData.mode}
                    onChange={(e) => setFormData({ ...formData, mode: e.target.value })}
                    className="w-full px-3 sm:px-4 py-3 sm:py-2.5 text-base border border-border rounded-[var(--radius)] focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                  >
                    {MODES.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="departure" className="text-sm font-medium">{t("departure")}</Label>
                  <Input
                    id="departure"
                    type="date"
                    value={formData.departure}
                    onChange={(e) => setFormData({ ...formData, departure: e.target.value })}
                    className="h-11 sm:h-10 text-base"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="capacity" className="text-sm font-medium">{t("capacity")}</Label>
                  <div className="flex gap-2">
                    <Input
                      id="capacity"
                      type="number"
                      min="1"
                      max="100"
                      value={formData.capacity}
                      onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                      placeholder="20"
                      className="flex-1 h-11 sm:h-10 text-base"
                      required
                    />
                    <div className="flex items-center px-3 sm:px-4 bg-surface border border-border rounded-[var(--radius)] text-xs sm:text-sm text-muted font-medium whitespace-nowrap">
                      {t("capacityUnit")}
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes" className="text-sm font-medium">{t("notes")}</Label>
                  <textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder={t("notesPlaceholder")}
                    className="w-full px-3 sm:px-4 py-3 sm:py-2.5 text-base border border-border rounded-[var(--radius)] focus:outline-none focus:ring-2 focus:ring-primary h-20 resize-none"
                  />
                </div>
              </div>
            </Card>

            {/* Info Card */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base sm:text-lg">How it works</CardTitle>
              </CardHeader>
              <div className="px-4 sm:px-6 pb-4 sm:pb-6 text-xs sm:text-sm text-muted space-y-1.5 sm:space-y-2">
                <p>1. Publish your trip and capacity</p>
                <p>2. Review and accept shipments matching your route</p>
                <p>3. Receive items at hub, verify contents, deliver</p>
                <p>4. Confirm delivery with photo from receiver</p>
              </div>
            </Card>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-danger rounded-[var(--radius)] p-3 sm:p-4 text-danger text-xs sm:text-sm">
                {error}
              </div>
            )}

            {/* Submit */}
            <Button
              type="submit"
              size="lg"
              disabled={loading || !formData.route || !formData.departure || !formData.capacity}
              className="w-full h-12 sm:h-11 text-base font-semibold bg-primary text-primary-foreground hover:bg-navy-900"
            >
              {loading ? t("publishing") : t("publish")}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
