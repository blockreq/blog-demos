import { cn } from "@blockreq/ui";

/**
 * Practical product blurb above the main stage — neon/strong weight for the
 * demo's own utility sentence (*.guide). Not the old ToolGuideBanner strip.
 */
export function ToolBlurb({
  text,
  className,
}: {
  text?: string | null;
  className?: string;
}) {
  if (!text?.trim()) return null;
  return (
    <p
      className={cn(
        "tool-blurb border border-[rgba(0,240,255,0.4)] bg-[rgba(0,240,255,0.08)] px-3.5 py-2.5 text-[13px] font-semibold leading-snug tracking-[0.01em] text-[var(--color-neon-cyan)] shadow-[0_0_18px_rgba(0,240,255,0.12)] sm:text-[14px]",
        className
      )}
      role="note"
    >
      {text}
    </p>
  );
}
