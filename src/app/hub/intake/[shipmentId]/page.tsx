"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/logo";
import { LocaleSwitcher } from "@/components/locale-switcher";

type Step = "intake" | "verify" | "seal";

export default function HubIntakePage({
  params,
}: {
  params: Promise<{ shipmentId: string }>;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [shipmentId, setShipmentId] = useState<string>("");
  const [step, setStep] = useState<Step>("intake");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Intake form
  const [intakeData, setIntakeData] = useState({
    actualWeight: "",
    cashChecked: false,
  });
  const intakeVideoRef = useRef<HTMLVideoElement>(null);
  const intakeCanvasRef = useRef<HTMLCanvasElement>(null);
  const [intakePhoto, setIntakePhoto] = useState<string | null>(null);

  // Step 2: Verify form
  const verifyVideoRef = useRef<HTMLVideoElement>(null);
  const verifyCanvasRef = useRef<HTMLCanvasElement>(null);
  const [verifyPhoto, setVerifyPhoto] = useState<string | null>(null);

  // Step 3: Seal form
  const [sealId, setSealId] = useState("");

  React.useEffect(() => {
    params.then((p) => setShipmentId(p.shipmentId));
  }, [params]);

  async function startCamera(
    videoRef: React.RefObject<HTMLVideoElement>,
    canvasRef: React.RefObject<HTMLCanvasElement>,
    setPhoto: (photo: string | null) => void
  ) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setError("Unable to access camera");
    }
  }

  function capturePhoto(
    videoRef: React.RefObject<HTMLVideoElement>,
    canvasRef: React.RefObject<HTMLCanvasElement>,
    setPhoto: (photo: string) => void
  ) {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext("2d");
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const photoData = canvasRef.current.toDataURL("image/jpeg");
        setPhoto(photoData);
        stopCamera(videoRef);
      }
    }
  }

  function stopCamera(videoRef: React.RefObject<HTMLVideoElement>) {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach((track) => track.stop());
    }
  }

  async function handleIntakeSubmit() {
    setError(null);
    setLoading(true);

    try {
      if (!intakePhoto) throw new Error("Photo required");

      const formData = new FormData();
      const photoBlob = await fetch(intakePhoto).then((r) => r.blob());
      formData.append("photo", photoBlob, "intake.jpg");
      formData.append("actualWeightKg", intakeData.actualWeight);
      formData.append("cashChecked", String(intakeData.cashChecked));

      const response = await fetch(`/api/v1/shipments/${shipmentId}/intake`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Intake failed");
      }

      setStep("verify");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifySubmit() {
    setError(null);
    setLoading(true);

    try {
      if (!verifyPhoto) throw new Error("Photo required");

      const formData = new FormData();
      const photoBlob = await fetch(verifyPhoto).then((r) => r.blob());
      formData.append("photo", photoBlob, "verify.jpg");

      const response = await fetch(`/api/v1/shipments/${shipmentId}/verify`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Verification failed");
      }

      setStep("seal");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  async function handleSealSubmit() {
    setError(null);
    setLoading(true);

    try {
      if (!sealId) throw new Error("Seal ID required");

      const response = await fetch(`/api/v1/shipments/${shipmentId}/seal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sealId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Seal failed");
      }

      router.push("/hub/dashboard");
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
          {/* Step Indicator */}
          <div className="mb-8 flex gap-2">
            {(["intake", "verify", "seal"] as const).map((s, idx) => (
              <div key={s} className="flex-1">
                <div
                  className={`h-2 rounded-full transition-colors ${
                    s === step ? "bg-primary" : ["intake", "verify"].includes(s) ? "bg-muted" : "bg-border"
                  }`}
                />
                <p className="text-xs text-muted mt-2 capitalize">{s}</p>
              </div>
            ))}
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">Hub Intake: Step {["intake", "verify", "seal"].indexOf(step) + 1}</h1>
          <p className="text-sm text-muted mb-6">{`Shipment ${shipmentId}`}</p>

          {/* Step 1: Intake */}
          {step === "intake" && (
            <Card>
              <CardHeader>
                <CardTitle>Receive & Weigh</CardTitle>
                <CardDescription>Take a photo, verify weight, and mark cash checked</CardDescription>
              </CardHeader>
              <div className="px-4 sm:px-6 pb-6 space-y-5">
                {!intakePhoto ? (
                  <div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => startCamera(intakeVideoRef, intakeCanvasRef, setIntakePhoto)}
                      className="w-full"
                    >
                      Start Camera
                    </Button>
                    <video
                      ref={intakeVideoRef}
                      autoPlay
                      playsInline
                      className="w-full mt-4 rounded-lg bg-black"
                    />
                    <canvas ref={intakeCanvasRef} hidden />
                    <Button
                      type="button"
                      onClick={() => capturePhoto(intakeVideoRef, intakeCanvasRef, setIntakePhoto)}
                      className="w-full mt-3 bg-primary text-primary-foreground"
                    >
                      Capture Photo
                    </Button>
                  </div>
                ) : (
                  <div>
                    <img src={intakePhoto} alt="Intake" className="w-full rounded-lg mb-4" />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIntakePhoto(null)}
                      className="w-full"
                    >
                      Retake Photo
                    </Button>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="weight">Actual Weight (kg)</Label>
                  <Input
                    id="weight"
                    type="number"
                    value={intakeData.actualWeight}
                    onChange={(e) => setIntakeData({ ...intakeData, actualWeight: e.target.value })}
                    placeholder="5.2"
                    className="h-11"
                    required
                  />
                </div>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={intakeData.cashChecked}
                    onChange={(e) => setIntakeData({ ...intakeData, cashChecked: e.target.checked })}
                    className="h-5 w-5"
                  />
                  <span className="text-sm">No cash or valuables present</span>
                </label>

                {error && <div className="bg-red-50 border border-danger rounded p-3 text-danger text-sm">{error}</div>}

                <Button
                  onClick={handleIntakeSubmit}
                  disabled={loading || !intakePhoto || !intakeData.actualWeight}
                  className="w-full h-11 bg-primary text-primary-foreground"
                >
                  {loading ? "Processing..." : "Proceed to Verify"}
                </Button>
              </div>
            </Card>
          )}

          {/* Step 2: Verify */}
          {step === "verify" && (
            <Card>
              <CardHeader>
                <CardTitle>Verify Contents</CardTitle>
                <CardDescription>Take a photo of the sealed package contents</CardDescription>
              </CardHeader>
              <div className="px-4 sm:px-6 pb-6 space-y-5">
                {!verifyPhoto ? (
                  <div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => startCamera(verifyVideoRef, verifyCanvasRef, setVerifyPhoto)}
                      className="w-full"
                    >
                      Start Camera
                    </Button>
                    <video
                      ref={verifyVideoRef}
                      autoPlay
                      playsInline
                      className="w-full mt-4 rounded-lg bg-black"
                    />
                    <canvas ref={verifyCanvasRef} hidden />
                    <Button
                      type="button"
                      onClick={() => capturePhoto(verifyVideoRef, verifyCanvasRef, setVerifyPhoto)}
                      className="w-full mt-3 bg-primary text-primary-foreground"
                    >
                      Capture Photo
                    </Button>
                  </div>
                ) : (
                  <div>
                    <img src={verifyPhoto} alt="Verify" className="w-full rounded-lg mb-4" />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setVerifyPhoto(null)}
                      className="w-full"
                    >
                      Retake Photo
                    </Button>
                  </div>
                )}

                {error && <div className="bg-red-50 border border-danger rounded p-3 text-danger text-sm">{error}</div>}

                <Button
                  onClick={handleVerifySubmit}
                  disabled={loading || !verifyPhoto}
                  className="w-full h-11 bg-primary text-primary-foreground"
                >
                  {loading ? "Processing..." : "Proceed to Seal"}
                </Button>
              </div>
            </Card>
          )}

          {/* Step 3: Seal */}
          {step === "seal" && (
            <Card>
              <CardHeader>
                <CardTitle>Apply Seal</CardTitle>
                <CardDescription>Enter the seal ID to finalize intake</CardDescription>
              </CardHeader>
              <div className="px-4 sm:px-6 pb-6 space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="sealId">Seal ID</Label>
                  <Input
                    id="sealId"
                    type="text"
                    value={sealId}
                    onChange={(e) => setSealId(e.target.value)}
                    placeholder="SL-001234"
                    className="h-11 font-mono text-lg tracking-wider"
                    required
                  />
                </div>

                {error && <div className="bg-red-50 border border-danger rounded p-3 text-danger text-sm">{error}</div>}

                <Button
                  onClick={handleSealSubmit}
                  disabled={loading || !sealId}
                  className="w-full h-11 bg-primary text-primary-foreground"
                >
                  {loading ? "Finalizing..." : "Complete Intake"}
                </Button>
              </div>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
