import type { ReactNode } from "react";
import type { Locale } from "@blockreq/i18n";
import { t } from "@blockreq/i18n";
import { Badge, cn } from "@blockreq/ui";

export type WatchParam = {
  label: string;
  value: string;
  mono?: boolean;
  copyable?: boolean;
};

/** Plain-language watch target + relevant parameters from demo config. */
export function WatchTargetPanel({
  locale,
  watching,
  chainLabel,
  params,
  sourceStatus,
  trailing,
  className,
}: {
  locale: Locale;
  watching: string;
  chainLabel: string;
  params: WatchParam[];
  /** e.g. "HTTPS ready · tip synced" */
  sourceStatus?: string;
  trailing?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2.5",
        className
      )}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--color-muted-foreground)]">
          {t(locale, "tool.watching")}
        </span>
        <Badge variant="secondary">{chainLabel}</Badge>
        {sourceStatus ? (
          <span className="font-mono text-[10px] text-[var(--color-ok)]">{sourceStatus}</span>
        ) : null}
        {trailing ? <div className="ml-auto">{trailing}</div> : null}
      </div>
      <p className="text-sm font-semibold leading-snug text-[var(--color-foreground)]">{watching}</p>
      <dl className="mt-2.5 grid gap-1.5 sm:grid-cols-2">
        {params.map((p) => (
          <div
            key={p.label}
            className="grid grid-cols-[7.5rem_1fr] items-baseline gap-2 border border-[rgba(30,30,46,0.85)] bg-[#07070E] px-2 py-1.5"
          >
            <dt className="font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--color-muted-foreground)]">
              {p.label}
            </dt>
            <dd
              className={cn(
                "min-w-0 truncate text-[12px]",
                p.mono !== false && "font-mono text-[#D0D5E8]",
                (p.mono || p.value.startsWith("0x")) && "addr"
              )}
              title={p.value}
            >
              {p.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
