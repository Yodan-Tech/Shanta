import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "accent" | "outline" | "ghost";
type Size = "default" | "sm" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-foreground hover:bg-navy-900 focus-visible:ring-ring",
  accent:
    "bg-accent text-accent-foreground hover:bg-amber-600 focus-visible:ring-amber-600",
  outline:
    "border border-border bg-background text-foreground hover:bg-surface focus-visible:ring-ring",
  ghost: "text-foreground hover:bg-surface focus-visible:ring-ring",
};

const sizes: Record<Size, string> = {
  default: "h-11 px-5 text-base",
  sm: "h-9 px-3 text-sm",
  lg: "h-12 px-6 text-base",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "default", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[var(--radius)] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";
