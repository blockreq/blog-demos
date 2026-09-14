import type { ReactNode } from "react";
import type { Locale } from "@blockreq/i18n";
import { t } from "@blockreq/i18n";
import { Badge, Separator, cn } from "@blockreq/ui";
import { displayTags, scrubDemoText, type FeedEvent } from "../feed-types";
import { WatchTargetPanel, type WatchParam } from "../watch-target-panel";
import { RecentHistoryPanel } from "../recent-history-panel";
import { LiveToggle } from "../live-toggle";
import { SourceStrip, type SourceItem } from "../source-strip";
import type { HistoryState } from "../../lib/recent-history";
import { FreshnessChip } from "../monitor-chrome";
import { Addr } from "../addr";
import { ToolBlurb } from "../tool-blurb";
import { BrowserNotifControls, useLiveHitBrowserNotify } from "../../lib/notifications";

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
  guide,
  watching,
  hint,
  emptyTitle,
  emptySub,
  latestLabel,
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
  guide?: string;
  watching?: string;
  hint?: string;
  emptyTitle?: string;
  emptySub?: string;
  latestLabel?: string;
}) {
  const displayPool =
    events.length > 0 ? events : history.events.length > 0 ? history.events : seedEvents;
  const selected =
    displayPool.find((e) => e.id === selectedId) || displayPool[0] || null;
  const listening = running && !connecting;
  const isLiveRow = (id: string) => events.some((e) => e.id === id);
  const liveSelected = !!(selected && isLiveRow(selected.id));
  useLiveHitBrowserNotify({
    locale,
    liveEvent: events[0] || null,
    enabled: running || connecting,
  });

  return (
    <div className="demo-shell flex min-h-[calc(100vh-8rem)] min-w-0 flex-col gap-3 overflow-x-hidden">
      {banner}
      {endpointSlot}
      <SourceStrip items={sourceItems} />
      <WatchTargetPanel
        locale={locale}
        watching={watching || t(locale, "anoncoin.watching")}
        chainLabel={chainBadge}
        params={watchParams}
        sourceStatus={
          history.status === "loading"
            ? t(locale, "tool.sourceLoading")
            : t(locale, "tool.sourceReady")
        }
      />
      <ToolBlurb text={guide} />

      <div className="flex flex-wrap items-center gap-2">
        <LiveToggle
          locale={locale}
          live={running}
          connecting={connecting}
          onPause={onPause}
          onResume={onResume}
        />
        <BrowserNotifControls locale={locale} />
        <Badge variant="ok">{chainBadge}</Badge>
        <span className="text-xs text-[var(--color-muted-foreground)]">{hint || t(locale, "anoncoin.hint")}</span>
      </div>

      <div className="grid min-w-0 flex-1 gap-3 overflow-x-hidden lg:grid-cols-[1.1fr_0.9fr]">
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

        <aside className="flex min-h-0 min-w-0 flex-col overflow-x-hidden">
          <div
            data-hit={liveSelected ? "true" : undefined}
            data-highlight={selected?.highlight ? "true" : undefined}
            className={cn(
              "focus-card live-surface sticky top-0 flex min-h-[300px] flex-1 flex-col gap-3 p-4",
              liveSelected && "hit-panel-flash",
              selected?.highlight && "border-[rgba(0,240,255,0.55)]"
            )}
          >
            {!selected ? (
              <div className="flex flex-1 flex-col items-center justify-center text-center text-[var(--color-muted-foreground)]">
                <p className="type-title text-[var(--color-foreground)]">{emptyTitle || t(locale, "anoncoin.emptyTitle")}</p>
                <p className="mt-2 text-sm">{emptySub || t(locale, "anoncoin.emptySub")}</p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge variant={liveSelected ? "hit" : "secondary"}>
                    {liveSelected ? (latestLabel || t(locale, "anoncoin.latest")) : t(locale, "common.lastHit")}
                  </Badge>
                  <FreshnessChip locale={locale} at={selected.at} live={liveSelected || listening} />
                  <span className="type-meta">
                    {liveSelected ? ageLabel(selected.at) : `#${selected.block ?? "—"}`}
                  </span>
                </div>

                <h2
                  className={cn("type-hit", selected.highlight && "text-[var(--color-neon-cyan)]")}
                  title={selected.address || scrubDemoText(selected.title || selected.kind)}
                >
                  {scrubDemoText(selected.title || selected.kind)}
                </h2>
                <p className="text-[15px] font-bold text-[var(--color-neon-mag)]">{scrubDemoText(selected.kind)}</p>

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

                <div className="grid grid-cols-[90px_minmax(0,1fr)] gap-x-2.5 gap-y-1.5 text-[13px]">
                  {selected.address ? (
                    <>
                      <span className="text-[var(--color-muted-foreground)]">Token</span>
                      <Addr value={selected.address} className="w-full text-[12px]" />
                    </>
                  ) : null}
                  {selected.maker ? (
                    <>
                      <span className="text-[var(--color-muted-foreground)]">Maker</span>
                      <Addr value={selected.maker} className="w-full text-[12px]" />
                    </>
                  ) : null}
                  {selected.tx ? (
                    <>
                      <span className="text-[var(--color-muted-foreground)]">Tx</span>
                      <Addr value={selected.tx} className="w-full text-[12px]" />
                    </>
                  ) : null}
                  <span className="text-[var(--color-muted-foreground)]">Meta</span>
                  <span className="min-w-0 truncate font-mono text-[12px] text-[#C8CDDF]" title={scrubDemoText(selected.body)}>{scrubDemoText(selected.body)}</span>
                </div>
                {selected.links?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {selected.links.map((link) => (
                      <a
                        key={link.href + link.label}
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-9 items-center border border-[rgba(0,240,255,0.35)] bg-[rgba(0,240,255,0.08)] px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--color-neon-cyan)] hover:brightness-110"
                      >
                        {link.label}
                      </a>
                    ))}
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-1">
                  {displayTags(selected.tags).map((tag) => (
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
