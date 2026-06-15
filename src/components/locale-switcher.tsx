"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/utils";

const LOCALE_COOKIE = "NEXT_LOCALE";

/** Toggles the UI language by setting the locale cookie and refreshing. */
export function LocaleSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function setLocale(next: "en" | "am") {
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000`;
    startTransition(() => router.refresh());
  }

  return (
    <div className={cn("inline-flex items-center gap-1 text-sm", className)}>
      <button
        type="button"
        onClick={() => setLocale("en")}
        disabled={isPending}
        className={cn(
          "rounded px-2 py-1",
          locale === "en" ? "font-semibold text-navy" : "text-muted",
        )}
      >
        EN
      </button>
      <span className="text-border">|</span>
      <button
        type="button"
        onClick={() => setLocale("am")}
        disabled={isPending}
        className={cn(
          "rounded px-2 py-1",
          locale === "am" ? "font-semibold text-navy" : "text-muted",
        )}
      >
        አማ
      </button>
    </div>
  );
}
