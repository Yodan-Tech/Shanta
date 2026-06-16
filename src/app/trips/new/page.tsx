"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/logo";
import { LocaleSwitcher } from "@/components/locale-switcher";

const ROUTES = [
  { id: "addis-dawa", from: "Addis Ababa", to: "Dire Dawa" },
  { id: "addis-hawassa", from: "Addis Ababa", to: "Hawassa" },
  { id: "addis-bahirdar", from: "Addis Ababa", to: "Bahir Dar" },
  { id: "addis-adama", from: "Addis Ababa", to: "Adama" },
];

export default function CreateTripPage() {
  const t = useTranslations("trips");
  const router = useRouter();
  const [formData, setFormData] = useState({
    route: "",
    departure: "",
    capacity: "",
    notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // TODO: Submit to API
    console.log("[v0] Trip form submitted:", formData);
    setLoading(false);

    // For now, just redirect back to dashboard
    router.push("/dashboard?action=travel");
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <Logo />
        <LocaleSwitcher />
      </header>
      <main className="flex-1 px-6 py-10">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold text-foreground mb-2">{t("create")}</h1>
          <p className="text-muted mb-8">{t("details")}</p>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Route Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t("route")}</CardTitle>
              </CardHeader>
              <div className="px-6 pb-6">
                <select
                  value={formData.route}
                  onChange={(e) => setFormData({ ...formData, route: e.target.value })}
                  className="w-full px-4 py-3 border border-border rounded-[var(--radius)] focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                >
                  <option value="">Choose your route...</option>
                  {ROUTES.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.from} → {r.to}
                    </option>
                  ))}
                </select>
              </div>
            </Card>

            {/* Trip Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Travel Details</CardTitle>
              </CardHeader>
              <div className="px-6 pb-6 space-y-4">
                <div>
                  <Label htmlFor="departure">{t("departure")}</Label>
                  <Input
                    id="departure"
                    type="date"
                    value={formData.departure}
                    onChange={(e) => setFormData({ ...formData, departure: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="capacity">{t("capacity")}</Label>
                  <div className="flex gap-2">
                    <Input
                      id="capacity"
                      type="number"
                      min="1"
                      max="100"
                      value={formData.capacity}
                      onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                      placeholder="20"
                      className="flex-1"
                      required
                    />
                    <div className="flex items-center px-4 bg-surface border border-border rounded-[var(--radius)] text-sm text-muted">
                      {t("capacityUnit")}
                    </div>
                  </div>
                </div>
                <div>
                  <Label htmlFor="notes">{t("notes")}</Label>
                  <textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder={t("notesPlaceholder")}
                    className="w-full px-4 py-3 border border-border rounded-[var(--radius)] focus:outline-none focus:ring-2 focus:ring-primary h-20"
                  />
                </div>
              </div>
            </Card>

            {/* Info Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">How it works</CardTitle>
              </CardHeader>
              <div className="px-6 pb-6 text-sm text-muted space-y-2">
                <p>1. Publish your trip and capacity</p>
                <p>2. Review and accept shipments matching your route</p>
                <p>3. Receive items at hub, verify contents, deliver</p>
                <p>4. Confirm delivery with photo from receiver</p>
              </div>
            </Card>

            {/* Error */}
            {error && <div className="bg-red-50 border border-danger rounded-[var(--radius)] p-4 text-danger text-sm">{error}</div>}

            {/* Submit */}
            <Button
              type="submit"
              size="lg"
              disabled={loading || !formData.route || !formData.departure || !formData.capacity}
              className="w-full bg-primary text-primary-foreground hover:bg-navy-900"
            >
              {loading ? t("publishing") : t("publish")}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
