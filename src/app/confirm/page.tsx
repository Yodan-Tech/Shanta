"use client";

import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/logo";

export default function ConfirmDeliveryPage() {
  const t = useTranslations("confirm");
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showProblem, setShowProblem] = useState(false);
  const [problem, setProblem] = useState("");

  useEffect(() => {
    if (!token) {
      setError("Invalid delivery link");
    }
  }, [token]);

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
      if (!token) throw new Error("Invalid token");

      const response = await fetch("/api/v1/delivery/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          token,
          problem: false,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Confirmation failed");
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  async function handleProblem() {
    setLoading(true);
    setError(null);

    try {
      if (!token) throw new Error("Invalid token");
      if (!problem.trim()) throw new Error("Please describe the problem");

      const response = await fetch("/api/v1/delivery/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          token,
          problem: true,
          reason: problem,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Dispute submission failed");
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  // Invalid token
  if (!token) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <header className="flex items-center px-6 py-4 border-b border-border">
          <Logo />
        </header>
        <main className="flex flex-1 items-center justify-center px-6">
          <Card className="w-full max-w-md text-center">
            <CardHeader>
              <CardTitle>Invalid Link</CardTitle>
              <CardDescription>This delivery confirmation link is invalid or has expired.</CardDescription>
            </CardHeader>
          </Card>
        </main>
      </div>
    );
  }

  // Success screen
  if (success) {
    const successTitle = showProblem ? "Dispute Submitted" : "Confirmed";
    const successDesc = showProblem
      ? "Your dispute has been submitted and will be reviewed by our team."
      : "Thank you for confirming delivery. Your payment is secure in escrow.";

    return (
      <div className="flex min-h-screen flex-col bg-background">
        <header className="flex items-center px-6 py-4 border-b border-border">
          <Logo />
        </header>
        <main className="flex flex-1 items-center justify-center px-6">
          <Card className="w-full max-w-md text-center">
            <CardHeader>
              <div className="text-4xl mb-4">{showProblem ? "⚠️" : "✓"}</div>
              <CardTitle>{successTitle}</CardTitle>
              <CardDescription>{successDesc}</CardDescription>
            </CardHeader>
          </Card>
        </main>
      </div>
    );
  }

  // Dispute form
  if (showProblem) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <header className="flex items-center px-6 py-4 border-b border-border">
          <Logo />
        </header>
        <main className="flex-1 px-6 py-10">
          <div className="max-w-md mx-auto">
            <h1 className="text-3xl font-bold text-foreground mb-2">Report Issue</h1>
            <p className="text-muted mb-8">Let us know what went wrong with this delivery</p>

            <Card>
              <div className="px-6 py-6 space-y-4">
                <div className="space-y-2">
                  <label htmlFor="problem" className="text-sm font-medium text-foreground">
                    What is the problem?
                  </label>
                  <textarea
                    id="problem"
                    value={problem}
                    onChange={(e) => setProblem(e.target.value)}
                    placeholder="Describe the issue..."
                    className="w-full px-3 py-2 border border-border rounded-[var(--radius)] focus:outline-none focus:ring-2 focus:ring-primary h-24 resize-none text-sm"
                  />
                </div>

                {error && <div className="bg-red-50 border border-danger rounded p-3 text-danger text-sm">{error}</div>}

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowProblem(false)}
                    className="flex-1"
                    disabled={loading}
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    onClick={handleProblem}
                    disabled={loading || !problem.trim()}
                    className="flex-1 bg-danger text-danger-foreground hover:bg-red-700"
                  >
                    {loading ? "Submitting..." : "Submit Dispute"}
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  // Main confirm screen
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center px-6 py-4 border-b border-border">
        <Logo />
      </header>
      <main className="flex-1 px-6 py-10">
        <div className="max-w-md mx-auto">
          <h1 className="text-3xl font-bold text-foreground mb-2">{t("title")}</h1>
          <p className="text-muted mb-8">{t("subtitle")}</p>

          {/* Camera Section */}
          {!photo ? (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg">Take Delivery Photo</CardTitle>
                <CardDescription>Live camera capture required</CardDescription>
              </CardHeader>
              <div className="px-6 pb-6 space-y-4">
                {!cameraOpen ? (
                  <Button
                    type="button"
                    onClick={startCamera}
                    className="w-full bg-primary text-primary-foreground h-11"
                  >
                    Open Camera
                  </Button>
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className="w-full rounded-lg bg-black"
                    />
                    <canvas ref={canvasRef} hidden />
                    <Button
                      type="button"
                      onClick={capturePhoto}
                      className="w-full bg-success text-success-foreground"
                    >
                      Capture Photo
                    </Button>
                  </>
                )}
              </div>
            </Card>
          ) : (
            <Card className="mb-6">
              <div className="px-6 py-6 space-y-4">
                <img src={photo} alt="Delivery" className="w-full rounded-lg mb-4" />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPhoto(null)}
                  className="w-full"
                >
                  Retake Photo
                </Button>
              </div>
            </Card>
          )}

          {/* Error */}
          {error && <div className="bg-red-50 border border-danger rounded p-3 text-danger text-sm mb-6">{error}</div>}

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowProblem(true)}
              className="flex-1"
              disabled={loading}
            >
              Report Issue
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={loading || !photo}
              className="flex-1 bg-success text-success-foreground hover:bg-green-700"
            >
              {loading ? "Confirming..." : "Confirm Delivery"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
