"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

type State = "idle" | "loading" | "confirmed" | "disputed" | "error" | "invalid";

function ConfirmContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [state, setState] = useState<State>(token ? "idle" : "invalid");
  const [showProblem, setShowProblem] = useState(false);
  const [reason, setReason] = useState("");

  async function confirm(problem: boolean) {
    setState("loading");
    try {
      const res = await fetch("/api/v1/delivery/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, problem, reason: problem ? reason : undefined }),
      });
      const data = (await res.json()) as { data?: { outcome?: string }; error?: string };
      if (!res.ok) {
        setState("error");
        return;
      }
      setState(data.data?.outcome === "DISPUTED" ? "disputed" : "confirmed");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center px-6 py-4">
        <Logo />
      </header>

      <main className="flex flex-1 items-center justify-center px-6">
        <div className="w-full max-w-sm">
          {state === "invalid" && (
            <div className="text-center">
              <h1 className="text-xl font-bold">Invalid link</h1>
              <p className="mt-2 text-sm text-muted">
                This confirmation link is invalid or has expired.
              </p>
            </div>
          )}

          {state === "idle" && !showProblem && (
            <div className="text-center space-y-4">
              <h1 className="text-2xl font-bold">Your delivery has arrived!</h1>
              <p className="text-muted">Did you receive your package in good condition?</p>
              <Button className="w-full" onClick={() => void confirm(false)}>
                Yes, I received it
              </Button>
              <button
                type="button"
                className="block w-full text-sm text-danger hover:underline"
                onClick={() => setShowProblem(true)}
              >
                Report a problem
              </button>
            </div>
          )}

          {state === "idle" && showProblem && (
            <div className="space-y-4">
              <h1 className="text-xl font-bold">Report a problem</h1>
              <p className="text-sm text-muted">
                Describe what happened. Our team will review the evidence and follow up.
              </p>
              <textarea
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                rows={4}
                placeholder="e.g. The seal was broken, one item is missing"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <Button
                variant="outline"
                className="w-full border-danger text-danger"
                onClick={() => void confirm(true)}
                disabled={!reason.trim()}
              >
                Submit report
              </Button>
              <button
                type="button"
                className="block w-full text-sm text-muted hover:underline"
                onClick={() => setShowProblem(false)}
              >
                ← Go back
              </button>
            </div>
          )}

          {state === "loading" && (
            <div className="text-center">
              <p className="text-muted">Submitting…</p>
            </div>
          )}

          {state === "confirmed" && (
            <div className="text-center space-y-2">
              <div className="text-5xl">✓</div>
              <h1 className="text-xl font-bold">Delivery confirmed</h1>
              <p className="text-sm text-muted">
                Thank you. Your confirmation has been recorded.
              </p>
            </div>
          )}

          {state === "disputed" && (
            <div className="text-center space-y-2">
              <div className="text-5xl">!</div>
              <h1 className="text-xl font-bold">Dispute submitted</h1>
              <p className="text-sm text-muted">
                We&apos;ve recorded your report. Our team will review the evidence and contact you.
              </p>
            </div>
          )}

          {state === "error" && (
            <div className="text-center space-y-4">
              <h1 className="text-xl font-bold">Something went wrong</h1>
              <p className="text-sm text-muted">Please try again or contact support.</p>
              <Button onClick={() => setState("idle")}>Try again</Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><p className="text-muted">Loading…</p></div>}>
      <ConfirmContent />
    </Suspense>
  );
}
