import { cn } from "@/lib/utils";

/**
 * Shanta logo — the "S" mark (two interlocking strokes = people connected by
 * journeys) with two amber endpoint dots (sender ↔ receiver), per the brand system
 * (docs/DESIGN_SYSTEM.md). Navy #11234A + amber #F5BD2E.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label="Shanta"
      className={cn("h-8 w-8", className)}
    >
      <path
        d="M44 20a12 12 0 0 0-12-8H22a8 8 0 0 0 0 16h20a8 8 0 0 1 0 16H32a12 12 0 0 1-12-8"
        fill="none"
        stroke="#11234A"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="50" cy="15" r="5" fill="#F5BD2E" />
      <circle cx="14" cy="49" r="5" fill="#F5BD2E" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      <span className="text-xl font-bold tracking-tight text-navy">Shanta</span>
    </span>
  );
}
