import * as React from "react";
import * as TogglePrimitive from "@radix-ui/react-toggle";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../utils";

const toggleVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-[2px] text-sm font-bold transition-colors hover:bg-[rgba(0,240,255,0.08)] hover:text-[var(--color-neon-cyan)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-ring)] disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-[rgba(0,240,255,0.12)] data-[state=on]:text-[var(--color-neon-cyan)] data-[state=on]:shadow-[inset_0_0_0_1px_rgba(0,240,255,0.45)] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline:
          "border border-[var(--color-line)] bg-transparent hover:bg-[rgba(0,240,255,0.06)] hover:text-[var(--color-neon-cyan)]",
      },
      size: {
        default: "h-9 px-3 min-w-9",
        sm: "h-8 px-2.5 min-w-8",
        lg: "h-10 px-4 min-w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

const Toggle = React.forwardRef<
  React.ElementRef<typeof TogglePrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TogglePrimitive.Root> & VariantProps<typeof toggleVariants>
>(({ className, variant, size, ...props }, ref) => (
  <TogglePrimitive.Root
    ref={ref}
    className={cn(toggleVariants({ variant, size, className }))}
    {...props}
  />
));
Toggle.displayName = TogglePrimitive.Root.displayName;

export { Toggle, toggleVariants };
