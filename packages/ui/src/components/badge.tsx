import { cn } from "../utils";

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center border border-[rgba(0,240,255,0.35)] bg-[rgba(0,240,255,0.08)] px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--color-neon-cyan)]",
        className
      )}
      {...props}
    />
  );
}
