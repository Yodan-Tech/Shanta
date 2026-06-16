import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info";

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  default: "border-transparent bg-primary text-primary-foreground",
  secondary: "border-transparent bg-secondary text-secondary-foreground",
  destructive: "border-transparent bg-red-100 text-red-800",
  outline: "border-border text-foreground",
  success: "border-transparent bg-green-100 text-green-800",
  warning: "border-transparent bg-yellow-100 text-yellow-800",
  info: "border-transparent bg-blue-100 text-blue-800",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        VARIANT_CLASSES[variant],
        className,
      )}
      {...props}
    />
  );
}
