import { useState, type ComponentProps } from "react";
import type { Locale } from "@blockreq/i18n";
import { t } from "@blockreq/i18n";
import { EndpointBar } from "./endpoint-bar";

type EndpointBarProps = ComponentProps<typeof EndpointBar>;

/**
 * Collapsed-by-default Config slot wrapping EndpointBar.
 * Keeps WSS/HTTPS secondary so the main listen stage stays primary.
 */
export function EndpointConfigSlot({
  locale,
  wss,
  https,
  chainLabel,
  className,
  ...rest
}: EndpointBarProps & { locale: Locale }) {
  const [open, setOpen] = useState(false);
  const summaryHost = (wss || https || "")
    .replace(/^wss:\/\//i, "")
    .replace(/^https:\/\//i, "");

  return (
    <div className={className ? `space-y-2 ${className}` : "space-y-2"}>
      <button
        type="button"
        className="w-full border border-[rgba(0,240,255,0.14)] bg-[rgba(0,240,255,0.02)] px-3 py-1.5 text-left font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--color-muted-foreground)] hover:border-[rgba(0,240,255,0.3)]"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? t(locale, "shell.configOpen") : t(locale, "shell.configClosed")}
      </button>
      {open ? (
        <EndpointBar
          locale={locale}
          wss={wss}
          https={https}
          chainLabel={chainLabel}
          {...rest}
        />
      ) : (
        <p
          className="truncate px-1 font-mono text-[10px] text-[var(--color-muted-foreground)]"
          title={wss || https}
        >
          {chainLabel}
          {summaryHost ? ` · ${summaryHost}` : ""}
        </p>
      )}
    </div>
  );
}
