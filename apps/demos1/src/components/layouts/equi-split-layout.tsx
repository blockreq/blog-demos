import type { ReactNode } from "react";
import type { Locale } from "@blockreq/i18n";
import { t } from "@blockreq/i18n";
import { Badge, ScrollArea, Separator, cn } from "@blockreq/ui";
import type { FeedEvent } from "../feed-types";
import { ToolGuideBanner } from "../tool-guide";
import { WatchTargetPanel, type WatchParam } from "../watch-target-panel";
import { RecentHistoryPanel } from "../recent-history-panel";
import { LiveToggle } from "../live-toggle";
import { SourceStrip, type SourceItem } from "../source-strip";
import type { HistoryState } from "../../lib/recent-history";

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
  seedEvents,
  onPause,
  onResume,
  running,
  connecting,
  chainControls,
  settings,
  banner,
  history,
  watchParams,
  sourceItems,
  endpointSlot,
}: {
  locale: Locale;
  coinTitle: string;
  coinMeta: string;
  columns: EquiMarketColumn[];
  seedEvents: FeedEvent[];
  onPause: () => void;
  onResume: () => void;
  running: boolean;
  connecting: boolean;
  chainControls?: ReactNode;
  settings?: ReactNode;
  banner?: ReactNode;
  history: HistoryState;
  watchParams: WatchParam[];
  sourceItems: SourceItem[];
  endpointSlot?: ReactNode;
}) {
  const listening = running && !connecting;
  const hasAnyLive = columns.some((c) => c.events.length > 0);

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-3 p-3">
      <ToolGuideBanner locale={locale} stepHint={t(locale, "equifold.guide")} />
      {banner}
      {endpointSlot}
      <SourceStrip items={sourceItems} />
      <WatchTargetPanel
        locale={locale}
        watching={t(locale, "equifold.watching")}
        chainLabel={locale === "zh" ? "多市场" : "Multi"}
        params={watchParams}
        sourceStatus={
          history.status === "loading"
            ? t(locale, "tool.sourceLoading")
            : t(locale, "tool.sourceReady")
        }
        trailing={chainControls}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-[22px] font-black tracking-tight">{coinTitle}</p>
          <p className="mt-1 truncate font-mono text-[11px] text-[var(--color-muted-foreground)]">{coinMeta}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LiveToggle
            locale={locale}
            live={running}
            connecting={connecting}
            onPause={onPause}
            onResume={onResume}
          />
          <Badge>{t(locale, "equifold.badge")}</Badge>
          <span className="demo-seed">{t(locale, "common.seedLabel")}</span>
        </div>
      </div>

      {!hasAnyLive ? (
        <RecentHistoryPanel
          locale={locale}
          history={history}
          liveEvents={[]}
          seedEvents={seedEvents}
          listening={listening || connecting}
          dense
          className="min-h-[160px]"
        />
      ) : null}

      <div className="grid flex-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3">
        {columns.map((col) => (
          <section
            key={col.id}
            className="flex min-h-[280px] flex-col border border-[var(--color-line)] bg-[var(--color-panel)]"
          >
            <div className="flex items-center justify-between border-b border-[var(--color-line)] px-3 py-2">
              <h3 className="text-sm font-extrabold text-[var(--color-neon-cyan)]">{col.title}</h3>
              <div className="flex items-center gap-2">
                {col.events.some((e) => e.tags.includes("DEMO")) ? (
                  <span className="demo-seed">{t(locale, "common.seedLabel")}</span>
                ) : null}
                <span className="font-mono text-[11px] text-[var(--color-muted-foreground)]">
                  {col.events.length}
                </span>
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div>
                {col.events.length === 0 ? (
                  <div className="px-3 py-6 text-center text-xs text-[var(--color-muted-foreground)]">
                    {t(locale, "history.none")}
                    <p className="mt-1">{history.reason || t(locale, "equifold.emptyCol")}</p>
                  </div>
                ) : (
                  col.events.map((ev) => (
                    <div
                      key={ev.id}
                      className={cn(
                        "grid grid-cols-[1fr_auto] gap-1.5 border-b border-[rgba(30,30,46,0.85)] px-2.5 py-2",
                        !ev.tags.includes("DEMO") && "feed-row-flash"
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
                          <span className="font-mono text-[10px] text-[var(--color-muted-foreground)]">
                            #{ev.block}
                          </span>
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
