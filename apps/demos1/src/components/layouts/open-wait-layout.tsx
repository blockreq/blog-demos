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
}) {
  const feel = toFeelState(status, hasHit);
  const latest = events[0] || null;
  const stageTitle =
    feel === "connecting"
      ? t(locale, "openlaunch.stageConn")
      : feel === "hit"
        ? t(locale, "openlaunch.stageHit")
        : feel === "listening"
          ? t(locale, "openlaunch.stageListen")
          : t(locale, "openlaunch.stageIdle");
  const stageSub =
    feel === "connecting"
      ? t(locale, "openlaunch.hero.connecting")
      : feel === "hit"
        ? t(locale, "openlaunch.hero.hit")
        : feel === "listening"
          ? t(locale, "openlaunch.hero.listening")
          : t(locale, "openlaunch.hero.idle");

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-[920px] flex-col gap-3 p-3">
      <ToolGuideBanner locale={locale} stepHint={t(locale, "openlaunch.guide")} />
      {banner}
      {endpointSlot}
      <SourceStrip items={sourceItems} />
      <WatchTargetPanel
        locale={locale}
        watching={t(locale, "openlaunch.watching")}
        chainLabel="BASE"
        params={watchParams}
        sourceStatus={
          history.status === "loading"
            ? t(locale, "tool.sourceLoading")
            : t(locale, "tool.sourceReady")
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3 border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2.5">
        <div>
          <p className="text-[15px] font-extrabold">{t(locale, "openlaunch.stripTitle")}</p>
          <p className="mt-1 font-mono text-[11px] text-[var(--color-muted-foreground)]">
            {t(locale, "openlaunch.stripSub")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LiveToggle
            locale={locale}
            live={running}
            connecting={connecting}
            onPause={onPause}
            onResume={onResume}
          />
          <Badge variant="ok">BASE</Badge>
          <span className="demo-seed">{t(locale, "common.seedLabel")}</span>
        </div>
      </div>

      <div
        data-state={feel}
        className={cn(
          "relative flex min-h-[180px] flex-col overflow-hidden border border-[var(--color-line)] bg-[linear-gradient(180deg,rgba(0,240,255,0.04),transparent_45%),var(--color-panel)]",
          feel === "connecting" && "border-[rgba(255,209,102,0.45)]",
          feel === "listening" && "border-[rgba(0,240,255,0.45)]",
          feel === "hit" && "border-[rgba(255,43,214,0.55)] hit-panel-flash",
          feel === "idle" && "grayscale-[0.15]"
        )}
      >
        {feel !== "hit" ? (
          <div className="flex flex-1 flex-col items-center justify-center px-4 py-5 text-center">
            <div
              aria-hidden
              className={cn(
                "mb-3 h-12 w-12 rounded-full border-2 border-[rgba(0,240,255,0.35)] bg-[rgba(0,240,255,0.06)]",
                feel === "connecting" && "border-[rgba(255,209,102,0.55)] bg-[rgba(255,209,102,0.1)] wait-ring-amber",
                feel === "listening" && "wait-ring-live",
                feel === "idle" && "opacity-40 grayscale"
              )}
            />
            <p className="text-[24px] font-black tracking-tight">{stageTitle}</p>
            <p className="mt-2 max-w-[42ch] text-sm text-[var(--color-muted-foreground)]">{stageSub}</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2 font-mono text-[10px] text-[var(--color-muted-foreground)]">
              <span className="border border-[var(--color-line)] px-2 py-1">
                <b className="text-[var(--color-neon-cyan)]">CHAIN</b> Base
              </span>
              <span className="border border-[var(--color-line)] px-2 py-1">
                <b className="text-[var(--color-neon-cyan)]">METHOD</b> tx-listen
              </span>
              <span className="border border-[var(--color-line)] px-2 py-1">
                <b className="text-[var(--color-neon-cyan)]">WINDOW</b> one-shot
              </span>
            </div>
          </div>
        ) : latest ? (
          <div className="flex flex-1 items-center justify-center px-4 py-5">
            <div className="w-full max-w-lg border border-[rgba(255,43,214,0.45)] bg-[rgba(8,8,14,0.95)] p-4 text-left shadow-[0_0_28px_rgba(255,43,214,0.25)]">
              <Badge variant="hit" className="mb-2">
                {t(locale, "state.hit")}
              </Badge>
              <div className="text-[20px] font-black">{latest.title || latest.kind}</div>
              <div className="mt-1.5 font-mono text-xs text-[var(--color-muted-foreground)]">{latest.body}</div>
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
        title={t(locale, "openlaunch.recent")}
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
