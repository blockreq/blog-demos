import { useCallback } from "react";
import { t, type Locale } from "@blockreq/i18n";
import { cn } from "@blockreq/ui";
import { useDemoNotifs } from "../lib/notifications";

function pathLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const parts = window.location.pathname.split("/").filter(Boolean);
  const last = parts[parts.length - 1] || "";
  const maybe = parts[parts.length - 2] || last;
  if (last === "zh" || maybe === "zh") return "zh";
  return "en";
}

/**
 * Full address/hash display: prefer complete value; CSS truncate when narrow.
 * Click / Enter / Space copies the full string; title always shows full.
 * Copy feedback is an in-app toast (NotifBell / pushNotif), not an inline label swap.
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
  const { pushNotif } = useDemoNotifs();

  const copy = useCallback(async () => {
    if (!value) return;
    try {
      await navigator.clipboard?.writeText(value);
    } catch {
      /* ignore */
    }
    const locale = pathLocale();
    const truncated =
      value.length > 18 ? `${value.slice(0, 10)}…${value.slice(-6)}` : value;
    pushNotif({
      tone: "ok",
      title: t(locale, "endpoint.copied"),
      body: truncated,
      ttlMs: 3200,
    });
  }, [value, pushNotif]);

  if (!value) {
    return <span className={cn("addr", className)}>{empty}</span>;
  }

  const full = value;

  return (
    <button
      type="button"
      className={cn(
        "addr inline-flex max-w-full min-w-0 cursor-pointer border-0 bg-transparent p-0 text-left font-mono text-inherit hover:text-[var(--color-neon-cyan)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[rgba(0,240,255,0.55)]",
        className
      )}
      title={full}
      data-full={full}
      aria-label={`Copy ${full}`}
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
      <span className="block min-w-0 truncate">{full}</span>
    </button>
  );
}
