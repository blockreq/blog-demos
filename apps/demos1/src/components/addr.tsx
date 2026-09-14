import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@blockreq/ui";

/**
 * Full address/hash display: prefer complete value; CSS truncate when narrow.
 * Click / Enter / Space copies the full string; title always shows full.
 */
export function Addr({
  value,
  className,
  empty = "—",
}: {
  value?: string | null;
  className?: string;
  empty?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current != null) window.clearTimeout(timer.current);
    };
  }, []);

  const copy = useCallback(async () => {
    if (!value) return;
    try {
      await navigator.clipboard?.writeText(value);
    } catch {
      /* ignore */
    }
    setCopied(true);
    if (timer.current != null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1200);
  }, [value]);

  if (!value) {
    return <span className={cn("addr", className)}>{empty}</span>;
  }

  const full = value;
  const label = copied ? "Copied" : full;

  return (
    <button
      type="button"
      className={cn(
        "addr inline-flex max-w-full min-w-0 cursor-pointer border-0 bg-transparent p-0 text-left font-mono text-inherit hover:text-[var(--color-neon-cyan)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[rgba(0,240,255,0.55)]",
        className
      )}
      title={copied ? "Copied" : full}
      data-full={full}
      aria-label={copied ? "Copied" : `Copy ${full}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void copy();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          void copy();
        }
      }}
    >
      <span className="block min-w-0 truncate" aria-live="polite">
        {label}
      </span>
    </button>
  );
}
