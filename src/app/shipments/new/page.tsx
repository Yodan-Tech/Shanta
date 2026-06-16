"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

interface ItemForm {
  category: string;
  description: string;
  declaredWeightKg: string;
  declaredValueEtb: string;
}

const CATEGORIES = [
  "CLOTHING", "ELECTRONICS", "FOOD", "SPICES", "COFFEE",
  "DOCUMENTS", "COSMETICS", "JEWELRY", "HOUSEHOLD", "OTHER",
];

export default function NewShipmentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ItemForm[]>([
    { category: "CLOTHING", description: "", declaredWeightKg: "", declaredValueEtb: "" },
  ]);
  const [form, setForm] = useState({
    receiverName: "",
    receiverPhone: "",
    originRegion: "",
    destinationRegion: "",
    insuranceOptedIn: false,
  });

  function addItem() {
    setItems((prev) => [
      ...prev,
      { category: "CLOTHING", description: "", declaredWeightKg: "", declaredValueEtb: "" },
    ]);
  }

  function updateItem(idx: number, field: keyof ItemForm, value: string) {
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)),
    );
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/v1/shipments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          items: items.map((it) => ({
            category: it.category,
            description: it.description,
            declaredWeightKg: parseFloat(it.declaredWeightKg) || 0,
            declaredValueEtb: it.declaredValueEtb ? parseFloat(it.declaredValueEtb) : undefined,
          })),
        }),
      });
      const data = (await res.json()) as { data?: { shipment?: { id: string } }; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to create shipment.");
        return;
      }
      const id = data.data?.shipment?.id;
      router.push(id ? `/shipments/${id}` : "/shipments");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-xl flex-1 px-6 py-8">
        <h1 className="mb-6 text-xl font-bold">Send a package</h1>

        <form onSubmit={onSubmit} className="space-y-6">
          {/* Receiver */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Receiver details</CardTitle>
              <CardDescription>Who will receive this package?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="receiverName">Receiver name</Label>
                <Input
                  id="receiverName"
                  required
                  value={form.receiverName}
                  onChange={(e) => setForm((f) => ({ ...f, receiverName: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="receiverPhone">Receiver phone (+251…)</Label>
                <Input
                  id="receiverPhone"
                  type="tel"
                  required
                  placeholder="+2519XXXXXXXX"
                  value={form.receiverPhone}
                  onChange={(e) => setForm((f) => ({ ...f, receiverPhone: e.target.value }))}
                />
              </div>
            </CardContent>
          </Card>

          {/* Route */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Route</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="origin">From (city)</Label>
                <Input
                  id="origin"
                  required
                  placeholder="e.g. Addis Ababa"
                  value={form.originRegion}
                  onChange={(e) => setForm((f) => ({ ...f, originRegion: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="destination">To (city)</Label>
                <Input
                  id="destination"
                  required
                  placeholder="e.g. Hawassa"
                  value={form.destinationRegion}
                  onChange={(e) => setForm((f) => ({ ...f, destinationRegion: e.target.value }))}
                />
              </div>
            </CardContent>
          </Card>

          {/* Items */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Items</CardTitle>
              <CardDescription>List everything in the package.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map((item, idx) => (
                <div key={idx} className="rounded-lg border border-border p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Item {idx + 1}</span>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="text-xs text-danger hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div>
                    <Label>Category</Label>
                    <select
                      className="mt-1 w-full rounded border border-border px-3 py-2 text-sm bg-background"
                      value={item.category}
                      onChange={(e) => updateItem(idx, "category", e.target.value)}
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Input
                      required
                      placeholder="e.g. 3 cotton shirts"
                      value={item.description}
                      onChange={(e) => updateItem(idx, "description", e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Weight (kg)</Label>
                      <Input
                        type="number"
                        required
                        min="0.1"
                        step="0.1"
                        placeholder="2.5"
                        value={item.declaredWeightKg}
                        onChange={(e) => updateItem(idx, "declaredWeightKg", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Value ETB (optional)</Label>
                      <Input
                        type="number"
                        min="0"
                        placeholder="500"
                        value={item.declaredValueEtb}
                        onChange={(e) => updateItem(idx, "declaredValueEtb", e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addItem}
                className="text-sm text-navy hover:underline"
              >
                + Add another item
              </button>
            </CardContent>
          </Card>

          {/* Insurance */}
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={form.insuranceOptedIn}
              onChange={(e) => setForm((f) => ({ ...f, insuranceOptedIn: e.target.checked }))}
              className="h-4 w-4 accent-[var(--color-navy)]"
            />
            <span className="text-sm">
              Add insurance <span className="text-muted">(covers loss or damage)</span>
            </span>
          </label>

          {error && (
            <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-danger">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating shipment…" : "Create shipment"}
          </Button>
        </form>
      </main>
    </div>
  );
}
