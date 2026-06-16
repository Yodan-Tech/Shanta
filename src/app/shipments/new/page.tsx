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
  const [formData, setFormData] = useState({
    route: "",
    items: "",
    receiverPhone: "",
    insurance: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pricing = calculatePricing();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // TODO: Submit to API
    console.log("[v0] Shipment form submitted:", formData);
    setLoading(false);

    // For now, just redirect back to dashboard
    router.push("/dashboard?action=send");
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
                      {r.from} → {r.to}
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
