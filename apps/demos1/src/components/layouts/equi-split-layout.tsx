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
import { FreshnessChip } from "../monitor-chrome";

export type EquiMarketColumn = {
  id: string;
  title: string;
  events: FeedEvent[];
};

function parseMetricNum(m?: string): number | null {
  if (!m) return null;
  const n = Number(String(m).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Multi-market focus: cross-column price/volume diffs as the hero. */
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
  lastUpdateAt,
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
  lastUpdateAt?: number | null;
}) {
  const listening = running && !connecting;
  const hasAnyLive = columns.some((c) => c.events.length > 0);

  const tops = columns.map((c) => c.events[0] || null);
  const prices = tops.map((e) => parseMetricNum(e?.metric));
  const validPrices = prices.filter((p): p is number => p != null);
  const minP = validPrices.length ? Math.min(...validPrices) : null;
  const maxP = validPrices.length ? Math.max(...validPrices) : null;
  const leadIdx =
    maxP != null ? prices.findIndex((p) => p === maxP) : tops.findIndex((e) => e?.tags.includes("FIRST"));

  const spread =
    minP != null && maxP != null && minP > 0
      ? (((maxP - minP) / minP) * 100).toFixed(2)
      : null;

  return (
    <div className="demo-shell flex min-h-[calc(100vh-8rem)] flex-col gap-3">
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

      <div className="flex flex-wrap items-center justify-between gap-3 border border-[var(--color-line)] bg-[var(--color-panel)] px-3.5 py-3">
        <div className="min-w-0">
          <p className="type-display truncate">{coinTitle}</p>
          <p className="mt-1 truncate type-meta">{coinMeta}</p>
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
          <FreshnessChip locale={locale} at={lastUpdateAt} live={running} />
        </div>
      </div>

      {/* Cross-market diff strip — primary visual focus */}
      <div className="focus-card grid gap-2 p-3.5 sm:grid-cols-[1.1fr_repeat(3,minmax(0,1fr))]">
        <div className="flex flex-col justify-center gap-1 border border-[var(--color-line)] bg-[#07070E] px-3 py-2.5 sm:border-0 sm:bg-transparent sm:px-1">
          <div className="type-metric-label">{locale === "zh" ? "跨市场价差" : "Cross-market spread"}</div>
          <div key={`spread-${spread}-${lastUpdateAt || 0}`} className="type-metric metric-tick">
            {spread != null ? `${spread}%` : "—"}
          </div>
          <p className="type-meta text-[11px]">
            {locale === "zh" ? "高亮列 = 最高价 / FIRST" : "Hot column = highest price / FIRST"}
          </p>
        </div>
        {columns.map((col, i) => {
          const top = tops[i];
          const px = prices[i];
          const vsMin =
            px != null && minP != null && minP > 0 ? (((px - minP) / minP) * 100).toFixed(2) : null;
          const isLead = i === leadIdx;
          return (
            <div
              key={col.id}
              className={cn(
                "border border-[var(--color-line)] bg-[#07070E] px-3 py-2.5",
                isLead && "col-diff-lead",
                !isLead && top && !top.tags.includes("DEMO") && "col-diff-hot"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] font-bold text-[var(--color-neon-cyan)]">{col.title}</span>
                {isLead ? <Badge variant="hit">LEAD</Badge> : null}
              </div>
              <div key={`${top?.id || col.id}-px`} className="type-metric metric-tick mt-1 ">
                {top?.metric || "—"}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 type-meta text-[11px]">
                <span>{top?.metric2 || "—"}</span>
                {vsMin != null ? (
                  <span className={cn(Number(vsMin) > 0 ? "text-[var(--color-ok)]" : "text-[var(--color-muted-foreground)]")}>
                    {Number(vsMin) > 0 ? `+${vsMin}%` : `${vsMin}%`}
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {!hasAnyLive ? (
        <RecentHistoryPanel
          locale={locale}
          history={history}
          liveEvents={[]}
          seedEvents={seedEvents}
          listening={listening || connecting}
          dense
          flashNewest
          className="min-h-[160px]"
        />
      ) : null}

      <div className="grid flex-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3">
        {columns.map((col, colIdx) => (
          <section
            key={col.id}
            className={cn(
              "flex min-h-[280px] flex-col border border-[var(--color-line)] bg-[var(--color-panel)]",
              colIdx === leadIdx && "col-diff-lead",
              colIdx === leadIdx && lastUpdateAt && "just-ticked"
            )}
          >
            <div className="flex items-center justify-between border-b border-[var(--color-line)] px-3 py-2.5">
              <h3 className="text-[15px] font-extrabold text-[var(--color-neon-cyan)]">{col.title}</h3>
              <div className="flex items-center gap-2">
                {col.events.some((e) => e.tags.includes("DEMO")) ? (
                  <span className="demo-seed">{t(locale, "common.seedLabel")}</span>
                ) : null}
                <span className="font-mono text-[12px] font-bold text-[var(--color-foreground)]">
                  {col.events.length}
                </span>
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div>
                {col.events.length === 0 ? (
                  <div className="px-3 py-6 text-center text-sm text-[var(--color-muted-foreground)]">
                    {t(locale, "history.none")}
                    <p className="mt-1 text-xs">{history.reason || t(locale, "equifold.emptyCol")}</p>
                  </div>
                ) : (
                  col.events.map((ev, idx) => (
                    <div
                      key={ev.id}
                      className={cn(
                        "grid grid-cols-[1fr_auto] gap-1.5 border-b border-[rgba(30,30,46,0.85)] px-2.5 py-2.5",
                        idx === 0 && "row-focus",
                        idx === 0 && !ev.tags.includes("DEMO") && "feed-row-flash is-insert"
                      )}
                    >
                      <div className="min-w-0">
                        <div className="type-body truncate text-[14px]">{ev.title || ev.kind}</div>
                        <div className="mt-0.5 truncate type-meta">{ev.body}</div>
                        {ev.metric ? (
                          <div key={`${ev.id}-m`} className="metric-tick mt-1 font-mono text-[15px] font-extrabold text-[var(--color-neon-cyan)]">
                            {ev.metric}
                            {ev.metric2 ? <span className="ml-2 text-[12px] text-[var(--color-muted-foreground)]">{ev.metric2}</span> : null}
                          </div>
                        ) : null}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {ev.tags.slice(0, 1).map((tag) => (
                          <Badge key={tag} variant="secondary" className="px-1.5 py-0.5 text-[9px]">
                            {tag}
                          </Badge>
                        ))}
                        {typeof ev.block === "number" ? (
                          <span className="font-mono text-[11px] text-[var(--color-muted-foreground)]">#{ev.block}</span>
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
