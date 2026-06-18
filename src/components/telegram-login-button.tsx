"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

declare global {
  interface Window {
    __shantaTelegramAuth?: (user: Record<string, unknown>) => void;
  }
}

interface TelegramLoginButtonProps {
  botUsername?: string | undefined;
  nextHref: string;
  intentSummary?: string | undefined;
}

/** Telegram login widget wrapper. Posts the verified payload to the server auth bridge. */
export function TelegramLoginButton({
  botUsername,
  nextHref,
  intentSummary,
}: TelegramLoginButtonProps) {
  const router = useRouter();
  const widgetRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!botUsername || !widgetRef.current) return;

    const existingScript = widgetRef.current.querySelector("script");
    existingScript?.remove();

    window.__shantaTelegramAuth = async (user) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/v1/auth/telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(user),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as {
            error?: { message?: string } | string;
          } | null;
          const message =
            typeof payload?.error === "string"
              ? payload.error
              : payload?.error?.message ?? "Telegram sign-in failed.";
          throw new Error(message);
        }

        router.replace(nextHref);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Telegram sign-in failed.");
      } finally {
        setLoading(false);
      }
    };

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-userpic", "false");
    script.setAttribute("data-request-access", "write");
    script.setAttribute("data-onauth", "window.__shantaTelegramAuth(user)");

    widgetRef.current.appendChild(script);

    return () => {
      delete window.__shantaTelegramAuth;
      script.remove();
    };
  }, [botUsername, nextHref, router]);

  if (!botUsername) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle>Telegram login</CardTitle>
          <CardDescription>
            Configure <code>NEXT_PUBLIC_TELEGRAM_BOT_USERNAME</code> to enable the Telegram
            login widget.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-navy/20 bg-navy/5">
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Continue with Telegram</CardTitle>
          {loading && <span className="text-xs text-muted">Signing in...</span>}
        </div>
        <CardDescription>
          One tap when you already use Telegram. This is the fastest path for senders and
          agents.
        </CardDescription>
        {intentSummary && (
          <p className="text-sm font-medium text-foreground">{intentSummary}</p>
        )}
      </CardHeader>
      <div className="px-6 pb-6 space-y-4">
        <div ref={widgetRef} className="flex items-center justify-start" />
        {error && <p className="text-sm text-danger font-medium">{error}</p>}
        <p className="text-xs text-muted">
          Telegram is primary. If you prefer, you can continue with email or phone below.
        </p>
      </div>
    </Card>
  );
}
