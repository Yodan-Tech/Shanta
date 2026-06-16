"use client";

import { useState, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/logo";

// Mock shipment data - in real app, fetch from API using linkCode
const MOCK_SHIPMENT = {
  id: "SHIP-001",
  from: "Addis Ababa",
  to: "Dire Dawa",
  description: "Clothes and books",
  senderName: "Abebe",
  status: "out_for_delivery",
};

export default function ConfirmDeliveryPage({
  params,
}: {
  params: Promise<{ linkCode: string }>;
}) {
  const t = useTranslations("confirm");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showProblem, setShowProblem] = useState(false);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraOpen(true);
      }
    } catch (err) {
      console.error("[v0] Camera error:", err);
      setError("Unable to access camera");
    }
  }

  function capturePhoto() {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext("2d");
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const photoData = canvasRef.current.toDataURL("image/jpeg");
        setPhoto(photoData);
        stopCamera();
      }
    }
  }

  function stopCamera() {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach((track) => track.stop());
      setCameraOpen(false);
    }
  }

  async function handleConfirm() {
    setLoading(true);
    setError(null);

    try {
      // TODO: Submit confirmation to API with photo and linkCode
      console.log("[v0] Confirmed delivery with photo");
      setSuccess(true);
    } catch (err) {
      setError(t("error"));
    } finally {
      setLoading(false);
    }
  }

  async function handleProblem() {
    setLoading(true);
    setError(null);

    try {
      // TODO: Report problem to API with linkCode
      console.log("[v0] Reported delivery problem");
      setSuccess(true);
    } catch (err) {
      setError(t("error"));
    } finally {
      setLoading(false);
    }
  }

  // Success screen
  if (success) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <header className="flex items-center justify-between px-6 py-4 border-b border-border">
          <Logo />
        </header>
        <main className="flex flex-1 items-center justify-center px-6">
          <Card className="w-full max-w-md text-center">
            <CardHeader>
              <div className="text-4xl mb-4">✓</div>
              <CardTitle>{t("success")}</CardTitle>
              <CardDescription>Thank you for confirming delivery. Your payment is secure in escrow.</CardDescription>
            </CardHeader>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <Logo />
      </header>
      <main className="flex-1 px-6 py-10">
        <div className="max-w-md mx-auto">
          <h1 className="text-3xl font-bold text-foreground mb-2">{t("title")}</h1>
          <p className="text-muted mb-8">{t("subtitle")}</p>

          {/* Shipment Summary */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">{MOCK_SHIPMENT.description}</CardTitle>
            </CardHeader>
            <div className="px-6 pb-6 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">{t("from")}</span>
                <span className="font-semibold">{MOCK_SHIPMENT.from}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">{t("to")}</span>
                <span className="font-semibold">{MOCK_SHIPMENT.to}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">From:</span>
                <span className="font-semibold">{MOCK_SHIPMENT.senderName}</span>
              </div>
            </div>
          </Card>

          {/* Camera or Photo Preview */}
          {cameraOpen ? (
            <div className="space-y-4 mb-6">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full rounded-[var(--radius)] bg-foreground/5"
              />
              <div className="flex gap-2">
                <Button
                  onClick={capturePhoto}
                  size="lg"
                  className="flex-1 bg-accent text-accent-foreground hover:bg-amber-600"
                >
                  Capture
                </Button>
                <Button
                  onClick={stopCamera}
                  variant="outline"
                  size="lg"
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : photo ? (
            <div className="space-y-4 mb-6">
              <img
                src={photo}
                alt="Captured receipt confirmation"
                className="w-full rounded-[var(--radius)] bg-foreground/5"
              />
              <div className="flex gap-2">
                <Button
                  onClick={() => setPhoto(null)}
                  variant="outline"
                  size="lg"
                  className="flex-1"
                >
                  Retake
                </Button>
                <Button
                  onClick={handleConfirm}
                  disabled={loading}
                  size="lg"
                  className="flex-1 bg-primary text-primary-foreground hover:bg-navy-900"
                >
                  {loading ? "…" : t("confirm")}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              onClick={startCamera}
              size="lg"
              className="w-full mb-4 bg-primary text-primary-foreground hover:bg-navy-900"
            >
              {t("takeLivePhoto")}
            </Button>
          )}

          {/* Error */}
          {error && <div className="bg-red-50 border border-danger rounded-[var(--radius)] p-4 text-danger text-sm mb-4">{error}</div>}

          {/* Problem Report */}
          <div className="border-t border-border pt-6">
            <Button
              onClick={() => setShowProblem(!showProblem)}
              variant="outline"
              className="w-full"
            >
              {t("problem")}
            </Button>
            {showProblem && (
              <div className="mt-4 p-4 bg-surface rounded-[var(--radius)]">
                <p className="text-sm text-muted mb-3">{t("problemDesc")}</p>
                <Button
                  onClick={handleProblem}
                  disabled={loading}
                  variant="outline"
                  className="w-full text-danger border-danger hover:bg-red-50"
                >
                  {loading ? "…" : "Report Issue"}
                </Button>
              </div>
            )}
          </div>

          {/* Hidden canvas for photo capture */}
          <canvas ref={canvasRef} className="hidden" />
        </div>
      </main>
    </div>
  );
}
