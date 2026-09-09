import * as React from "react";
import { cn } from "../utils";

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      className={cn(
        "font-mono text-xs font-bold uppercase tracking-[0.08em] text-[var(--color-muted-foreground)]",
        className
      )}
      {...props}
    />
  );
}
