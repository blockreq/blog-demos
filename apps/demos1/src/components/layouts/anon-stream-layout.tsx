import type { ReactNode } from "react";
import type { Locale } from "@blockreq/i18n";
import { t } from "@blockreq/i18n";
import { Badge, Separator, cn } from "@blockreq/ui";
import type { FeedEvent } from "../feed-types";
import { ToolGuideBanner } from "../tool-guide";
import { WatchTargetPanel, type WatchParam } from "../watch-target-panel";
import { RecentHistoryPanel } from "../recent-history-panel";
import { LiveToggle } from "../live-toggle";
import { SourceStrip, type SourceItem } from "../source-strip";
import type { HistoryState } from "../../lib/recent-history";
import { FreshnessChip } from "../monitor-chrome";

function ageLabel(at: number) {
  const s = Math.max(0, Math.floor((Date.now() - at) / 1000));
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m`;
}

/** Launch-feed focus: sticky latest-hit card is the hero; feed rows flash on insert. */
export function AnonStreamLayout({
  locale,
  events,
  seedEvents,
  selectedId,
  onSelect,
  onPause,
  onResume,
  running,
  connecting,
  settings,
  chainBadge = "RH",
  banner,
  history,
  watchParams,
  sourceItems,
  endpointSlot,
}: {
  locale: Locale;
  events: FeedEvent[];
  seedEvents: FeedEvent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onPause: () => void;
  onResume: () => void;
  running: boolean;
  connecting: boolean;
  settings?: ReactNode;
  chainBadge?: string;
  banner?: ReactNode;
  history: HistoryState;
  watchParams: WatchParam[];
  sourceItems: SourceItem[];
  endpointSlot?: ReactNode;
}) {
  const displayPool =
    events.length > 0 ? events : history.events.length > 0 ? history.events : seedEvents;
  const selected =
    displayPool.find((e) => e.id === selectedId) || displayPool[0] || null;
  const listening = running && !connecting;
  const isLiveRow = (id: string) => events.some((e) => e.id === id);
  const liveSelected = !!(selected && isLiveRow(selected.id));

  return (
    <div className="demo-shell flex min-h-[calc(100vh-8rem)] flex-col gap-3">
      <ToolGuideBanner locale={locale} stepHint={t(locale, "anoncoin.guide")} />
      {banner}
      {endpointSlot}
      <SourceStrip items={sourceItems} />
      <WatchTargetPanel
        locale={locale}
        watching={t(locale, "anoncoin.watching")}
        chainLabel={chainBadge}
        params={watchParams}
        sourceStatus={
          history.status === "loading"
            ? t(locale, "tool.sourceLoading")
            : t(locale, "tool.sourceReady")
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <LiveToggle
          locale={locale}
          live={running}
          connecting={connecting}
          onPause={onPause}
          onResume={onResume}
        />
        <Badge variant="ok">{chainBadge}</Badge>
        <span className="demo-seed">{t(locale, "common.seedLabel")}</span>
        <span className="text-xs text-[var(--color-muted-foreground)]">{t(locale, "anoncoin.hint")}</span>
        <span className="ml-auto font-mono text-[10px] text-[var(--color-neon-cyan)]">
          {t(locale, "tool.usePublic")}
        </span>
      </div>

      <div className="grid flex-1 gap-3 lg:grid-cols-[1.1fr_0.9fr]">
        <RecentHistoryPanel
          locale={locale}
          history={history}
          liveEvents={events}
          seedEvents={seedEvents}
          listening={listening || connecting}
          selectedId={selected?.id || null}
          onSelect={onSelect}
          flashNewest
          className="min-h-[280px]"
        />

        <aside className="flex min-h-0 flex-col">
          <div
            data-hit={liveSelected ? "true" : undefined}
            className={cn(
              "focus-card live-surface sticky top-0 flex min-h-[300px] flex-1 flex-col gap-3 p-4",
              liveSelected && "hit-panel-flash"
            )}
          >
            {!selected ? (
              <div className="flex flex-1 flex-col items-center justify-center text-center text-[var(--color-muted-foreground)]">
                <p className="type-title text-[var(--color-foreground)]">{t(locale, "anoncoin.emptyTitle")}</p>
                <p className="mt-2 text-sm">{t(locale, "anoncoin.emptySub")}</p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge variant={liveSelected ? "hit" : "secondary"}>
                    {liveSelected ? t(locale, "anoncoin.latest") : t(locale, "common.lastHit")}
                  </Badge>
                  {!liveSelected ? <span className="demo-seed">{t(locale, "common.seedLabel")}</span> : null}
                  <FreshnessChip locale={locale} at={selected.at} live={liveSelected || listening} />
                  <span className="type-meta">
                    {liveSelected ? ageLabel(selected.at) : `#${selected.block ?? "—"}`}
                  </span>
                </div>

                <h2 className="type-hit">{selected.title || selected.kind}</h2>
                <p className="text-[15px] font-bold text-[var(--color-neon-mag)]">{selected.kind}</p>

                {(selected.metric || typeof selected.block === "number") && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="border border-[var(--color-line)] bg-[#07070E] px-3 py-2.5">
                      <div className="type-metric-label">{selected.metricLabel || "LP"}</div>
                      <div key={`${selected.id}-m`} className="type-metric metric-tick mt-1">
                        {selected.metric || (typeof selected.block === "number" ? `#${selected.block}` : "—")}
                      </div>
                    </div>
                    <div className="border border-[var(--color-line)] bg-[#07070E] px-3 py-2.5">
                      <div className="type-metric-label">{t(locale, "anoncoin.colBlock")}</div>
                      <div key={`${selected.id}-b`} className="type-metric metric-tick mt-1 ">
                        {typeof selected.block === "number" ? `#${selected.block}` : "—"}
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-[90px_1fr] gap-x-2.5 gap-y-1.5 text-[13px]">
                  {selected.address ? (
                    <>
                      <span className="text-[var(--color-muted-foreground)]">Addr</span>
                      <span className="break-all font-mono text-[12px]">{selected.address}</span>
                    </>
                  ) : null}
                  {selected.tx ? (
                    <>
                      <span className="text-[var(--color-muted-foreground)]">Tx</span>
                      <span className="break-all font-mono text-[12px]">{selected.tx}</span>
                    </>
                  ) : null}
                  <span className="text-[var(--color-muted-foreground)]">Meta</span>
                  <span className="break-all font-mono text-[12px] text-[#C8CDDF]">{selected.body}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {selected.tags.map((tag) => (
                    <Badge key={tag}>{tag}</Badge>
                  ))}
                </div>
              </>
            )}
          </div>
        </aside>
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
