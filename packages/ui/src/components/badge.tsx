import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../utils";

const badgeVariants = cva(
  "inline-flex items-center border px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.08em]",
  {
    variants: {
      variant: {
        default:
          "border-[rgba(0,240,255,0.35)] bg-[rgba(0,240,255,0.08)] text-[var(--color-neon-cyan)]",
        secondary:
          "border-[var(--color-line)] bg-[var(--color-panel2)] text-[var(--color-muted-foreground)]",
        ok: "border-[rgba(57,255,154,0.45)] bg-[rgba(57,255,154,0.08)] text-[var(--color-ok)]",
        warn: "border-[rgba(255,209,102,0.45)] bg-[rgba(255,209,102,0.08)] text-[var(--color-warn)]",
        hit: "border-[rgba(255,43,214,0.55)] bg-[rgba(255,43,214,0.15)] text-white",
        live: "border-[rgba(57,255,154,0.55)] bg-[rgba(57,255,154,0.1)] text-[var(--color-ok)]",
        offline: "border-[#1E1E28] bg-[#0A0A10] text-[#5C6178]",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
