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
  { id: "addis-dubai", from: "Addis Ababa", fromRegion: "Addis Ababa", to: "Dubai", toRegion: "Dubai" },
  { id: "dubai-addis", from: "Dubai", fromRegion: "Dubai", to: "Addis Ababa", toRegion: "Addis Ababa" },
  { id: "addis-dawa", from: "Addis Ababa", fromRegion: "Addis Ababa", to: "Dire Dawa", toRegion: "Dire Dawa" },
  { id: "addis-hawassa", from: "Addis Ababa", fromRegion: "Addis Ababa", to: "Hawassa", toRegion: "Hawassa" },
  { id: "addis-bahirdar", from: "Addis Ababa", fromRegion: "Addis Ababa", to: "Bahir Dar", toRegion: "Bahir Dar" },
  { id: "addis-adama", from: "Addis Ababa", fromRegion: "Addis Ababa", to: "Adama", toRegion: "Adama" },
];

const calculatePricing = (baseAmount: number = 500) => {
  const carrierFee = baseAmount;
  const aggregatorFee = baseAmount * 0.1;
  const platformFee = baseAmount * 0.05;
  const insuranceFee = baseAmount * 0.03;
  const tax = (carrierFee + aggregatorFee + platformFee + insuranceFee) * 0.15;
  const total = carrierFee + aggregatorFee + platformFee + insuranceFee + tax;
  return { carrierFee, aggregatorFee, platformFee, insuranceFee, tax, total };
};

export default function CreateShipmentPage() {
  const t = useTranslations("shipments");
  const router = useRouter();
  const searchParams = useSearchParams();
  const originRegion = searchParams.get("originRegion") ?? "";
  const destinationRegion = searchParams.get("destinationRegion") ?? "";
  const weightKg = searchParams.get("weightKg") ?? "";
  const description = searchParams.get("description") ?? "";
  const receiverName = searchParams.get("receiverName") ?? "";
  const receiverPhone = searchParams.get("receiverPhone") ?? "";
  const defaultRoute = ROUTES.find(
    (route) =>
      route.from.toLowerCase() === originRegion.toLowerCase() &&
      route.to.toLowerCase() === destinationRegion.toLowerCase(),
  )?.id ?? "";
  const [formData, setFormData] = useState({
    route: defaultRoute,
    items: description,
    receiverPhone,
    receiverName,
    insurance: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pricing = calculatePricing();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const selectedRoute = ROUTES.find((r) => r.id === formData.route);
      if (!selectedRoute) {
        throw new Error("Invalid route selected");
      }
      const declaredWeightKg = Number(weightKg || 5);
      if (!Number.isFinite(declaredWeightKg) || declaredWeightKg <= 0) {
        throw new Error("Enter a valid item weight from the preview step.");
      }

      const response = await fetch("/api/v1/shipments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          receiverName: formData.receiverName || "Unknown",
          receiverPhone: formData.receiverPhone,
          originRegion: selectedRoute.fromRegion,
          destinationRegion: selectedRoute.toRegion,
          countryCode: "ET",
          insuranceOptedIn: formData.insurance,
          items: [
            {
              category: "GENERAL",
              description: formData.items,
              declaredWeightKg,
              declaredValueEtb: pricing.total,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Failed to create shipment");
      }

      const result = await response.json();
      const shipmentId = result.data?.id;
      
      if (shipmentId) {
        router.push(`/shipments/${shipmentId}`);
      } else {
        router.push("/dashboard?action=send");
      }
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
          <p className="text-sm text-muted mb-6 sm:mb-8">
            {t("details")} {originRegion && destinationRegion ? ` ${originRegion} → ${destinationRegion}` : ""}
          </p>

          <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
            {/* Route Selection */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base sm:text-lg">{t("selectRoute")}</CardTitle>
              </CardHeader>
              <div className="px-4 sm:px-6 pb-4 sm:pb-6">
                <select
                  value={formData.route}
                  onChange={(e) => setFormData({ ...formData, route: e.target.value })}
                  className="w-full px-3 sm:px-4 py-3 sm:py-2.5 text-base border border-border rounded-[var(--radius)] focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                  required
                >
                  <option value="">Choose a route...</option>
                  {ROUTES.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.from} {"→"} {r.to}
                    </option>
                  ))}
                </select>
              </div>
            </Card>

            {/* Items & Receiver */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base sm:text-lg">{t("items")}</CardTitle>
              </CardHeader>
              <div className="px-4 sm:px-6 pb-4 sm:pb-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium">Receiver Name</Label>
                  <Input
                    id="name"
                    type="text"
                    value={formData.receiverName}
                    onChange={(e) => setFormData({ ...formData, receiverName: e.target.value })}
                    placeholder="Full name"
                    className="h-11 sm:h-10 text-base"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="items" className="text-sm font-medium">{t("items")}</Label>
                  <textarea
                    id="items"
                    value={formData.items}
                    onChange={(e) => setFormData({ ...formData, items: e.target.value })}
                    placeholder={t("itemsPlaceholder")}
                    className="w-full px-3 sm:px-4 py-3 sm:py-2.5 text-base border border-border rounded-[var(--radius)] focus:outline-none focus:ring-2 focus:ring-primary h-24 resize-none"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-sm font-medium">{t("receiverPhone")}</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.receiverPhone}
                    onChange={(e) => setFormData({ ...formData, receiverPhone: e.target.value })}
                    placeholder={t("receiverPhonePlaceholder")}
                    className="h-11 sm:h-10 text-base"
                    required
                  />
                </div>
                <label className="flex items-start gap-3 cursor-pointer pt-2">
                  <input
                    type="checkbox"
                    checked={formData.insurance}
                    onChange={(e) => setFormData({ ...formData, insurance: e.target.checked })}
                    className="h-5 w-5 mt-1 flex-shrink-0"
                  />
                  <span>
                    <span className="font-semibold text-foreground text-sm sm:text-base">{t("insurance")}</span>
                    <span className="block text-xs sm:text-sm text-muted mt-1">{t("insuranceDesc")}</span>
                  </span>
                </label>
              </div>
            </Card>

            {/* Pricing Breakdown */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base sm:text-lg">{t("pricing")}</CardTitle>
                <CardDescription className="text-xs sm:text-sm mt-1">Transparent pricing — see exactly what you pay</CardDescription>
              </CardHeader>
              <div className="px-4 sm:px-6 pb-4 sm:pb-6 space-y-2 sm:space-y-3 text-xs sm:text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">{t("carrierFee")}</span>
                  <span className="font-semibold">{pricing.carrierFee} Br</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">{t("aggregatorFee")}</span>
                  <span className="font-semibold">{pricing.aggregatorFee.toFixed(0)} Br</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">{t("platformFee")}</span>
                  <span className="font-semibold">{pricing.platformFee.toFixed(0)} Br</span>
                </div>
                {formData.insurance && (
                  <div className="flex justify-between">
                    <span className="text-muted">{t("insuranceFee")}</span>
                    <span className="font-semibold">{pricing.insuranceFee.toFixed(0)} Br</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted">{t("tax")}</span>
                  <span className="font-semibold">{pricing.tax.toFixed(0)} Br</span>
                </div>
                <div className="border-t border-border pt-2 sm:pt-3 flex justify-between">
                  <span className="font-semibold text-foreground">{t("total")}</span>
                  <span className="text-base sm:text-lg font-bold text-primary">
                    {pricing.total.toFixed(0)} Br
                  </span>
                </div>
              </div>
            </Card>

            {/* Error */}
            {error && <div className="bg-red-50 border border-danger rounded-[var(--radius)] p-3 sm:p-4 text-danger text-xs sm:text-sm">{error}</div>}

            {/* Submit */}
            <Button
              type="submit"
              size="lg"
              disabled={loading || !formData.route}
              className="w-full h-12 sm:h-11 text-base font-semibold bg-primary text-primary-foreground hover:bg-navy-900"
            >
              {loading ? t("creating") : t("submit")}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
