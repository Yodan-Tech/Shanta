"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

/**
 * Aggregator guided intake flow. Three steps mapped to three API calls:
 * 1. Intake (weigh + photo + cash check)
 * 2. Verify (contents photo)
 * 3. Seal (seal ID)
 *
 * Photos are live-capture only (server enforces; <input capture="environment"> nudges mobile).
 * This is a client component so the camera and step state work naturally.
 */
export default function HubIntakePage({
  params,
}: {
  params: Promise<{ shipmentId: string }>;
}) {
  const { shipmentId } = use(params);
  const router = useRouter();
  const [step, setStep] = useState<"intake" | "verify" | "seal" | "done">("intake");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Intake step state
  const [actualWeight, setActualWeight] = useState("");
  const [cashChecked, setCashChecked] = useState(false);
  const [intakePhoto, setIntakePhoto] = useState<File | null>(null);

  // Verify step state
  const [contentsPhoto, setContentsPhoto] = useState<File | null>(null);

  // Seal step state
  const [sealId, setSealId] = useState("");

  async function submitIntake() {
    if (!intakePhoto) { setError("A live intake photo is required."); return; }
    if (!cashChecked) { setError("You must confirm the cash check."); return; }
    if (!actualWeight) { setError("Please enter the actual weight."); return; }
    setError(null);
    setLoading(true);
    try {
      const form = new FormData();
      form.append("photo", intakePhoto);
      form.append("actualWeightKg", actualWeight);
      form.append("cashChecked", "true");
      form.append("itemWeights", JSON.stringify([]));
      const res = await fetch(`/api/v1/shipments/${shipmentId}/intake`, {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) { setError(data.error ?? "Intake failed."); return; }
      setStep("verify");
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  async function submitVerify() {
    if (!contentsPhoto) { setError("A contents photo is required."); return; }
    setError(null);
    setLoading(true);
    try {
      const form = new FormData();
      form.append("photo", contentsPhoto);
      const res = await fetch(`/api/v1/shipments/${shipmentId}/verify`, {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) { setError(data.error ?? "Verification failed."); return; }
      setStep("seal");
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  async function submitSeal() {
    if (!sealId) { setError("Please enter the seal ID."); return; }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/shipments/${shipmentId}/seal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sealId }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) { setError(data.error ?? "Seal failed."); return; }
      setStep("done");
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  if (step === "done") {
    return (
      <div className="flex min-h-screen flex-col">
        <AppHeader />
        <main className="flex flex-1 flex-col items-center justify-center px-6">
          <div className="text-center">
            <div className="text-5xl mb-4">✓</div>
            <h1 className="text-xl font-bold">Package sealed and ready</h1>
            <p className="mt-2 text-muted">The shipment is verified and awaiting traveler assignment.</p>
            <Button className="mt-6" onClick={() => router.push("/hub")}>
              Back to hub console
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-lg flex-1 px-6 py-8">
        {/* Step indicator */}
        <div className="mb-6 flex items-center gap-2 text-sm">
          {(["intake", "verify", "seal"] as const).map((s, i) => (
            <span
              key={s}
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                step === s
                  ? "bg-navy text-white"
                  : i < ["intake", "verify", "seal"].indexOf(step)
                    ? "bg-green-100 text-green-800"
                    : "bg-surface text-muted"
              }`}
            >
              {i + 1}
            </span>
          ))}
          <span className="ml-2 font-medium capitalize">{step}</span>
        </div>

        {step === "intake" && (
          <Card>
            <CardHeader>
              <CardTitle>Hub intake</CardTitle>
              <CardDescription>Weigh the package and check for prohibited items.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="weight">Actual weight (kg)</Label>
                <Input
                  id="weight"
                  type="number"
                  min="0.1"
                  step="0.1"
                  placeholder="2.5"
                  value={actualWeight}
                  onChange={(e) => setActualWeight(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="photo">Intake photo (live camera only)</Label>
                <input
                  id="photo"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="mt-1 w-full text-sm"
                  onChange={(e) => setIntakePhoto(e.target.files?.[0] ?? null)}
                />
                {intakePhoto && (
                  <p className="mt-1 text-xs text-green-700">✓ {intakePhoto.name}</p>
                )}
              </div>
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={cashChecked}
                  onChange={(e) => setCashChecked(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[var(--color-navy)]"
                />
                <span className="text-sm">
                  I confirm this package does <strong>not</strong> contain undeclared cash
                  or prohibited items.
                </span>
              </label>
              {error && <p className="text-sm text-danger">{error}</p>}
              <Button className="w-full" onClick={submitIntake} disabled={loading}>
                {loading ? "Submitting…" : "Complete intake"}
              </Button>
            </CardContent>
          </Card>
        )}

        {step === "verify" && (
          <Card>
            <CardHeader>
              <CardTitle>Verify contents</CardTitle>
              <CardDescription>
                Photograph the contents so the traveler can inspect them.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="vphoto">Contents photo (live camera only)</Label>
                <input
                  id="vphoto"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="mt-1 w-full text-sm"
                  onChange={(e) => setContentsPhoto(e.target.files?.[0] ?? null)}
                />
                {contentsPhoto && (
                  <p className="mt-1 text-xs text-green-700">✓ {contentsPhoto.name}</p>
                )}
              </div>
              {error && <p className="text-sm text-danger">{error}</p>}
              <Button className="w-full" onClick={submitVerify} disabled={loading}>
                {loading ? "Submitting…" : "Mark contents verified"}
              </Button>
            </CardContent>
          </Card>
        )}

        {step === "seal" && (
          <Card>
            <CardHeader>
              <CardTitle>Apply tamper seal</CardTitle>
              <CardDescription>
                Apply a tamper-evident seal. Enter its ID below.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="sealId">Seal ID</Label>
                <Input
                  id="sealId"
                  placeholder="e.g. SEAL-20260616-001"
                  value={sealId}
                  onChange={(e) => setSealId(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-danger">{error}</p>}
              <Button className="w-full" onClick={submitSeal} disabled={loading}>
                {loading ? "Sealing…" : "Seal package"}
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
