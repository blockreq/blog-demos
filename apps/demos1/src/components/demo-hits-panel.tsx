import type { Locale } from "@blockreq/i18n";
import { t } from "@blockreq/i18n";
import { Badge, Button, cn } from "@blockreq/ui";

/** Dev/美工 controls — only visible when demoHits mode is on (or to turn it on). */
export function DemoHitsBanner({
  locale,
  enabled,
  onToggle,
  onInject,
  className,
}: {
  locale: Locale;
  enabled: boolean;
  onToggle: (on: boolean) => void;
  onInject?: () => void;
  className?: string;
}) {
  if (!enabled) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 border-b border-[rgba(255,209,102,0.35)] bg-[rgba(255,209,102,0.08)] px-3 py-2",
        className
      )}
      role="status"
    >
      <Badge variant="warn">{t(locale, "demoHits.badge")}</Badge>
      <span className="text-xs text-[var(--color-warn)]">{t(locale, "demoHits.banner")}</span>
      {onInject ? (
        <Button size="sm" variant="secondary" onClick={onInject} className="ml-auto min-h-8 w-auto text-xs">
          {t(locale, "demoHits.inject")}
        </Button>
      ) : (
        <span className="ml-auto" />
      )}
      <button
        type="button"
        onClick={() => onToggle(false)}
        className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
      >
        {t(locale, "demoHits.disable")}
      </button>
    </div>
  );
}
