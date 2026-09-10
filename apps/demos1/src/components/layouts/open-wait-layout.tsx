import type { ReactNode } from "react";
import type { Locale } from "@blockreq/i18n";
import { t } from "@blockreq/i18n";
import { Badge, Separator, cn } from "@blockreq/ui";
import type { FeedEvent } from "../feed-types";
import { toFeelState } from "../../lib/ui-state";
import type { ConnStatus } from "@blockreq/ui";
import { HeartbeatStrip } from "../feed-empty";
import { ToolGuideBanner } from "../tool-guide";
import { WatchTargetPanel, type WatchParam } from "../watch-target-panel";
import { RecentHistoryPanel } from "../recent-history-panel";
import { LiveToggle } from "../live-toggle";
import { SourceStrip, type SourceItem } from "../source-strip";
import type { HistoryState } from "../../lib/recent-history";
import { FreshnessChip } from "../monitor-chrome";
import { Addr } from "../addr";

/** Single-token / one-shot focus: big stage + price/trade metrics on hit. */
export function OpenWaitLayout({
  locale,
  status,
  hasHit,
  events,
  seedEvents,
  onPause,
  onResume,
  running,
  connecting,
  settings,
  banner,
  history,
  watchParams,
  sourceItems,
  endpointSlot,
  guide,
  watching,
  stripTitle,
  stripSub,
  stageIdle,
  stageConn,
  stageListen,
  stageHit,
  heroIdle,
  heroConnecting,
  heroListening,
  heroHit,
  recentTitle,
  chainBadge = "BASE",
}: {
  locale: Locale;
  status: ConnStatus;
  hasHit: boolean;
  events: FeedEvent[];
  seedEvents: FeedEvent[];
  onPause: () => void;
  onResume: () => void;
  running: boolean;
  connecting: boolean;
  settings?: ReactNode;
  banner?: ReactNode;
  history: HistoryState;
  watchParams: WatchParam[];
  sourceItems: SourceItem[];
  endpointSlot?: ReactNode;
  guide?: string;
  watching?: string;
  stripTitle?: string;
  stripSub?: string;
  stageIdle?: string;
  stageConn?: string;
  stageListen?: string;
  stageHit?: string;
  heroIdle?: string;
  heroConnecting?: string;
  heroListening?: string;
  heroHit?: string;
  recentTitle?: string;
  chainBadge?: string;
}) {
  const feel = toFeelState(status, hasHit);
  const latest = events[0] || null;
  const stageTitle =
    feel === "connecting"
      ? stageConn || t(locale, "openlaunch.stageConn")
      : feel === "hit"
        ? stageHit || t(locale, "openlaunch.stageHit")
        : feel === "listening"
          ? stageListen || t(locale, "openlaunch.stageListen")
          : stageIdle || t(locale, "openlaunch.stageIdle");
  const stageSub =
    feel === "connecting"
      ? heroConnecting || t(locale, "openlaunch.hero.connecting")
      : feel === "hit"
        ? heroHit || t(locale, "openlaunch.hero.hit")
        : feel === "listening"
          ? heroListening || t(locale, "openlaunch.hero.listening")
          : heroIdle || t(locale, "openlaunch.hero.idle");

  return (
    <div className="demo-shell flex min-h-[calc(100vh-8rem)] flex-col gap-3">
      <ToolGuideBanner locale={locale} stepHint={guide || t(locale, "openlaunch.guide")} />
      {banner}
      {endpointSlot}
      <SourceStrip items={sourceItems} />
      <WatchTargetPanel
        locale={locale}
        watching={watching || t(locale, "openlaunch.watching")}
        chainLabel={chainBadge}
        params={watchParams}
        sourceStatus={
          history.status === "loading"
            ? t(locale, "tool.sourceLoading")
            : t(locale, "tool.sourceReady")
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3 border border-[var(--color-line)] bg-[var(--color-panel)] px-3.5 py-3">
        <div>
          <p className="type-title">{stripTitle || t(locale, "openlaunch.stripTitle")}</p>
          <p className="mt-1 type-meta">{stripSub || t(locale, "openlaunch.stripSub")}</p>
        </div>
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
          <FreshnessChip locale={locale} at={latest?.at || seedEvents[0]?.at} live={running} />
        </div>
      </div>

      <div
        data-state={feel}
        className={cn(
          "focus-card live-surface relative flex min-h-[220px] flex-col overflow-hidden",
          feel === "connecting" && "border-[rgba(255,209,102,0.45)]",
          feel === "listening" && "border-[rgba(0,240,255,0.45)]",
          feel === "hit" && "border-[rgba(255,43,214,0.55)] hit-panel-flash",
          feel === "idle" && "grayscale-[0.15]"
        )}
        data-hit={feel === "hit" ? "true" : undefined}
      >
        {feel !== "hit" ? (
          <div className="flex flex-1 flex-col items-center justify-center px-4 py-6 text-center">
            <div
              aria-hidden
              className={cn(
                "mb-3 h-14 w-14 rounded-full border-2 border-[rgba(0,240,255,0.35)] bg-[rgba(0,240,255,0.06)]",
                feel === "connecting" && "border-[rgba(255,209,102,0.55)] bg-[rgba(255,209,102,0.1)] wait-ring-amber",
                feel === "listening" && "wait-ring-live",
                feel === "idle" && "opacity-40 grayscale"
              )}
            />
            <p className="type-display">{stageTitle}</p>
            <p className="mt-2 max-w-[42ch] text-[15px] text-[var(--color-muted-foreground)]">{stageSub}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2 font-mono text-[11px] text-[var(--color-muted-foreground)]">
              <span className="border border-[var(--color-line)] px-2.5 py-1.5">
                <b className="text-[var(--color-neon-cyan)]">CHAIN</b> {chainBadge}
              </span>
              <span className="border border-[var(--color-line)] px-2.5 py-1.5">
                <b className="text-[var(--color-neon-cyan)]">METHOD</b> tx-listen
              </span>
              <span className="border border-[var(--color-line)] px-2.5 py-1.5">
                <b className="text-[var(--color-neon-cyan)]">WINDOW</b> one-shot
              </span>
            </div>
          </div>
        ) : latest ? (
          <div className="flex flex-1 items-center justify-center px-4 py-6">
            <div className="w-full max-w-xl border border-[rgba(255,43,214,0.45)] bg-[rgba(8,8,14,0.95)] p-5 text-left shadow-[0_0_28px_rgba(255,43,214,0.25)]">
              <Badge variant="hit" className="mb-2">
                {t(locale, "state.hit")}
              </Badge>
              <div className="type-hit" title={latest.address || latest.title}>{latest.title || latest.kind}</div>
              <div className="mt-2 type-meta text-[13px]">{latest.body}</div>
              {latest.address ? (
                <div className="mt-2 font-mono text-[12px]">
                  <Addr value={latest.address} />
                </div>
              ) : null}

              <div className="mt-4 grid grid-cols-2 gap-2.5">
                <div className="border border-[rgba(0,240,255,0.3)] bg-[rgba(0,240,255,0.05)] px-3 py-3">
                  <div className="type-metric-label">
                    {latest.metricLabel || (locale === "zh" ? "价格" : "Price")}
                  </div>
                  <div key={`${latest.id}-px`} className="type-metric metric-tick mt-1">
                    {latest.metric || "—"}
                  </div>
                </div>
                <div className="border border-[rgba(255,43,214,0.3)] bg-[rgba(255,43,214,0.05)] px-3 py-3">
                  <div className="type-metric-label">
                    {latest.metric2Label || (locale === "zh" ? "成交额" : "Volume")}
                  </div>
                  <div key={`${latest.id}-vol`} className="type-metric metric-tick mt-1 !text-[var(--color-neon-mag)]">
                    {latest.metric2 || (typeof latest.block === "number" ? `#${latest.block}` : "—")}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1">
                {latest.tags.map((tag) => (
                  <Badge key={tag}>{tag}</Badge>
                ))}
              </div>
            </div>
          </div>
        ) : null}
        <HeartbeatStrip
          locale={locale}
          active={feel === "listening" || feel === "connecting"}
          className="mt-auto"
        />
      </div>

      <RecentHistoryPanel
        locale={locale}
        history={history}
        liveEvents={events}
        seedEvents={seedEvents}
        listening={feel === "listening" || feel === "connecting"}
        dense
        flashNewest
        title={recentTitle || t(locale, "openlaunch.recent")}
        className="min-h-[200px]"
      />

      {settings ? (
        <>
          <Separator />
          {settings}
        </>
      ) : null}
    </div>
  );
}
