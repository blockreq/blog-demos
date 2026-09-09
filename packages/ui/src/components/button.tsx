import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-base font-black tracking-wide transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] disabled:pointer-events-none disabled:opacity-50 rounded-[2px]",
  {
    variants: {
      variant: {
        default:
          "border border-[rgba(0,240,255,0.7)] text-[#041014] bg-[linear-gradient(90deg,#00F0FF,#7CFFF7_40%,#F1B92C)] shadow-[0_0_28px_rgba(0,240,255,0.28)] hover:brightness-110 clip-cta",
        secondary:
          "border border-[#3A3A55] bg-transparent text-[var(--color-foreground)] hover:bg-[rgba(255,255,255,0.04)]",
        outline:
          "border border-[var(--color-line)] bg-[var(--color-panel)] text-[var(--color-foreground)] hover:border-[rgba(0,240,255,0.45)]",
        destructive:
          "border border-[rgba(255,43,214,0.7)] bg-[rgba(255,43,214,0.15)] text-white hover:brightness-110",
      },
      size: {
        default: "min-h-[52px] px-6 py-[17px] text-[17px]",
        sm: "min-h-10 px-3 text-sm",
        lg: "min-h-[52px] w-full px-5 py-[17px] text-[17px]",
        icon: "h-12 w-12",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  )
);
Button.displayName = "Button";
