import type { Locale } from "@blockreq/i18n";
import { t } from "@blockreq/i18n";
import { cn } from "@blockreq/ui";

/** Ghost skeleton rows + heartbeat so waiting/listening never looks like a blank teaching page. */
export function FeedSkeletonRows({
  rows = 5,
  dense = false,
}: {
  rows?: number;
  dense?: boolean;
}) {
  return (
    <div className="pointer-events-none select-none" aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className={cn(
            "grid grid-cols-[48px_1fr_72px] items-center gap-2 border-b border-[rgba(30,30,46,0.65)] px-2.5",
            dense ? "py-1.5" : "py-2.5"
          )}
          style={{ opacity: Math.max(0.25, 0.85 - i * 0.12) }}
        >
          <span className="skel-bar h-2.5 w-8 justify-self-end" />
          <span className="min-w-0 space-y-1.5">
            <span className="skel-bar block h-3 w-[68%]" />
            <span className="skel-bar block h-2 w-[42%]" />
          </span>
          <span className="flex justify-end gap-1">
            <span className="skel-bar h-4 w-10" />
          </span>
        </div>
      ))}
    </div>
  );
}

export function HeartbeatStrip({
  locale,
  active,
  className,
}: {
  locale: Locale;
  active: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 border-t border-[rgba(30,30,46,0.85)] px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em]",
        active ? "text-[var(--color-neon-cyan)]" : "text-[var(--color-muted-foreground)]",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <span
        className={cn(
          "inline-block h-1.5 w-1.5 rounded-full bg-current",
          active && "dot-pulse shadow-[0_0_8px_currentColor]"
        )}
      />
      <span className={cn("heartbeat-line flex-1", active && "heartbeat-line-live")} aria-hidden />
      <span>{active ? t(locale, "empty.heartbeatLive") : t(locale, "empty.heartbeatIdle")}</span>
    </div>
  );
}

export function FeedEmpty({
  locale,
  listening,
  rows = 5,
  dense,
  caption,
  className,
}: {
  locale: Locale;
  listening: boolean;
  rows?: number;
  dense?: boolean;
  caption?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-[160px] flex-col", className)}>
      {caption ? (
        <p className="px-3 pt-3 text-xs text-[var(--color-muted-foreground)]">{caption}</p>
      ) : null}
      <div className="flex-1 pt-1">
        <FeedSkeletonRows rows={rows} dense={dense} />
      </div>
      <HeartbeatStrip locale={locale} active={listening} />
    </div>
  );
}
