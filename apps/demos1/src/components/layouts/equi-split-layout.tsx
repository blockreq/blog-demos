import type { ReactNode } from "react";
import type { Locale } from "@blockreq/i18n";
import { t } from "@blockreq/i18n";
import { Badge, Button, ScrollArea, Separator, cn } from "@blockreq/ui";
import type { FeedEvent } from "../feed-types";
import { FeedEmpty } from "../feed-empty";

export type EquiMarketColumn = {
  id: string;
  title: string;
  events: FeedEvent[];
};

export function EquiSplitLayout({
  locale,
  coinTitle,
  coinMeta,
  columns,
  onStart,
  onStop,
  running,
  connecting,
  chainControls,
  settings,
  banner,
}: {
  locale: Locale;
  coinTitle: string;
  coinMeta: string;
  columns: EquiMarketColumn[];
  onStart: () => void;
  onStop: () => void;
  running: boolean;
  connecting: boolean;
  chainControls?: ReactNode;
  settings?: ReactNode;
  banner?: ReactNode;
}) {
  const listening = running && !connecting;

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-3 p-3">
      {banner}
      <div className="flex flex-wrap items-center justify-between gap-3 border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-[22px] font-black tracking-tight">{coinTitle}</p>
          <p className="mt-1 truncate font-mono text-[11px] text-[var(--color-muted-foreground)]">{coinMeta}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!running ? (
            <Button size="sm" onClick={onStart} disabled={connecting} className="min-h-10 w-auto clip-cta">
              {connecting ? t(locale, "common.starting") : t(locale, "common.start")}
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={onStop} className="min-h-10 w-auto">
              {t(locale, "common.stop")}
            </Button>
          )}
          <Badge>{t(locale, "equifold.badge")}</Badge>
          {chainControls}
        </div>
      </div>

      <div className="grid flex-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3">
        {columns.map((col) => (
          <section
            key={col.id}
            className="flex min-h-[280px] flex-col border border-[var(--color-line)] bg-[var(--color-panel)]"
          >
            <div className="flex items-center justify-between border-b border-[var(--color-line)] px-3 py-2">
              <h3 className="text-sm font-extrabold text-[var(--color-neon-cyan)]">{col.title}</h3>
              <span className="font-mono text-[11px] text-[var(--color-muted-foreground)]">{col.events.length}</span>
            </div>
            <ScrollArea className="flex-1">
              <div>
                {col.events.length === 0 ? (
                  <FeedEmpty
                    locale={locale}
                    listening={listening || connecting}
                    rows={4}
                    dense
                    caption={t(locale, "equifold.emptyCol")}
                    className="min-h-[200px]"
                  />
                ) : (
                  col.events.map((ev) => (
                    <div
                      key={ev.id}
                      className={cn(
                        "grid grid-cols-[1fr_auto] gap-1.5 border-b border-[rgba(30,30,46,0.85)] px-2.5 py-2 feed-row-flash"
                      )}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-bold">{ev.title || ev.kind}</div>
                        <div className="mt-0.5 truncate font-mono text-[10px] text-[var(--color-muted-foreground)]">
                          {ev.body}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {ev.tags.slice(0, 1).map((tag) => (
                          <Badge key={tag} variant="secondary" className="px-1.5 py-0.5 text-[9px]">
                            {tag}
                          </Badge>
                        ))}
                        {typeof ev.block === "number" ? (
                          <span className="font-mono text-[10px] text-[var(--color-muted-foreground)]">#{ev.block}</span>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </section>
        ))}
      </div>

      {settings ? (
        <>
          <Separator />
          {settings}
        </>
      ) : null}
    </div>
  );
}
