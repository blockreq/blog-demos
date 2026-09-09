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

function ageLabel(at: number) {
  const s = Math.max(0, Math.floor((Date.now() - at) / 1000));
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m`;
}

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

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-3 p-3">
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

      <div className="grid flex-1 gap-3 lg:grid-cols-[1.15fr_0.85fr]">
        <RecentHistoryPanel
          locale={locale}
          history={history}
          liveEvents={events}
          seedEvents={seedEvents}
          listening={listening || connecting}
          selectedId={selected?.id || null}
          onSelect={onSelect}
          className="min-h-[280px]"
        />

        <aside className="flex min-h-0 flex-col">
          <div
            className={cn(
              "sticky top-0 flex min-h-[280px] flex-1 flex-col gap-2.5 border border-[var(--color-line)] bg-[var(--color-panel)] p-3.5",
              selected && isLiveRow(selected.id) && "hit-panel-flash"
            )}
          >
            {!selected ? (
              <div className="flex flex-1 flex-col items-center justify-center text-center text-[var(--color-muted-foreground)]">
                <p className="text-[22px] font-black tracking-tight text-[var(--color-foreground)]">
                  {t(locale, "anoncoin.emptyTitle")}
                </p>
                <p className="mt-2 text-sm">{t(locale, "anoncoin.emptySub")}</p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge variant={isLiveRow(selected.id) ? "hit" : "secondary"}>
                    {isLiveRow(selected.id)
                      ? t(locale, "anoncoin.latest")
                      : t(locale, "common.lastHit")}
                  </Badge>
                  {!isLiveRow(selected.id) ? (
                    <span className="demo-seed">{t(locale, "common.seedLabel")}</span>
                  ) : null}
                  <span className="font-mono text-[10px] text-[var(--color-muted-foreground)]">
                    {isLiveRow(selected.id) ? ageLabel(selected.at) : `#${selected.block ?? "—"}`}
                  </span>
                </div>
                <h2 className="text-[22px] font-black tracking-tight">{selected.title || selected.kind}</h2>
                <div className="grid grid-cols-[90px_1fr] gap-x-2.5 gap-y-1.5 text-xs">
                  <span className="text-[var(--color-muted-foreground)]">{t(locale, "anoncoin.colEvent")}</span>
                  <span className="font-bold text-[var(--color-neon-mag)]">{selected.kind}</span>
                  {selected.address ? (
                    <>
                      <span className="text-[var(--color-muted-foreground)]">Addr</span>
                      <span className="break-all font-mono text-[11px]">{selected.address}</span>
                    </>
                  ) : null}
                  {typeof selected.block === "number" ? (
                    <>
                      <span className="text-[var(--color-muted-foreground)]">{t(locale, "anoncoin.colBlock")}</span>
                      <span className="font-mono">#{selected.block}</span>
                    </>
                  ) : null}
                  {selected.tx ? (
                    <>
                      <span className="text-[var(--color-muted-foreground)]">Tx</span>
                      <span className="break-all font-mono text-[11px]">{selected.tx}</span>
                    </>
                  ) : null}
                  <span className="text-[var(--color-muted-foreground)]">Meta</span>
                  <span className="break-all font-mono text-[11px] text-[#C8CDDF]">{selected.body}</span>
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
