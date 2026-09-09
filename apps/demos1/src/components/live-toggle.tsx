import type { Locale } from "@blockreq/i18n";
import { t } from "@blockreq/i18n";
import { cn } from "@blockreq/ui";

/** Quieter primary control — live on by default; Pause / Resume (never 「开始盯」). */
export function LiveToggle({
  locale,
  live,
  connecting,
  onPause,
  onResume,
  className,
}: {
  locale: Locale;
  live: boolean;
  connecting?: boolean;
  onPause: () => void;
  onResume: () => void;
  className?: string;
}) {
  const on = live || !!connecting;
  return (
    <button
      type="button"
      className={cn("quiet-live", !on && "off", className)}
      data-on={on ? "true" : "false"}
      disabled={connecting}
      onClick={() => (on ? onPause() : onResume())}
    >
      <span
        className={cn(
          "inline-block h-1.5 w-1.5 rounded-full bg-current",
          on && "dot-pulse shadow-[0_0_8px_currentColor]"
        )}
        aria-hidden
      />
      {connecting
        ? t(locale, "common.starting")
        : on
          ? t(locale, "common.pause")
          : t(locale, "common.resume")}
    </button>
  );
}
