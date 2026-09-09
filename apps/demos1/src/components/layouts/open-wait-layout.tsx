import type { ReactNode } from "react";
import type { Locale } from "@blockreq/i18n";
import { t } from "@blockreq/i18n";
import { Badge, Button, Separator, cn } from "@blockreq/ui";
import type { FeedEvent } from "../feed-types";
import { toFeelState } from "../../lib/ui-state";
import type { ConnStatus } from "@blockreq/ui";
import { FeedEmpty, HeartbeatStrip } from "../feed-empty";

export function OpenWaitLayout({
  locale,
  status,
  hasHit,
  events,
  onStart,
  onStop,
  running,
  connecting,
  settings,
  banner,
}: {
  locale: Locale;
  status: ConnStatus;
  hasHit: boolean;
  events: FeedEvent[];
  onStart: () => void;
  onStop: () => void;
  running: boolean;
  connecting: boolean;
  settings?: ReactNode;
  banner?: ReactNode;
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
      {banner}
      <div className="flex flex-wrap items-center justify-between gap-3 border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2.5">
        <div>
          <p className="text-[15px] font-extrabold">{t(locale, "openlaunch.stripTitle")}</p>
          <p className="mt-1 font-mono text-[11px] text-[var(--color-muted-foreground)]">
            {t(locale, "openlaunch.stripSub")}
          </p>
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
          <Badge variant="ok">BASE</Badge>
        </div>
      </div>

      <div
        data-state={feel}
        className={cn(
          "relative flex min-h-[220px] flex-col overflow-hidden border border-[var(--color-line)] bg-[linear-gradient(180deg,rgba(0,240,255,0.04),transparent_45%),var(--color-panel)]",
          feel === "connecting" && "border-[rgba(255,209,102,0.45)]",
          feel === "listening" && "border-[rgba(0,240,255,0.45)]",
          feel === "hit" && "border-[rgba(255,43,214,0.55)] hit-panel-flash"
        )}
      >
        {feel !== "hit" ? (
          <div className="flex flex-1 flex-col items-center justify-center px-4 py-6 text-center">
            <div
              aria-hidden
              className={cn(
                "mb-4 h-14 w-14 rounded-full border-2 border-[rgba(0,240,255,0.35)] bg-[rgba(0,240,255,0.06)]",
                feel === "connecting" && "border-[rgba(255,209,102,0.55)] bg-[rgba(255,209,102,0.1)] wait-ring-amber",
                feel === "listening" && "wait-ring-live",
                feel === "idle" && "opacity-40 grayscale"
              )}
            />
            <p className="text-[28px] font-black tracking-tight">{stageTitle}</p>
            <p className="mt-2 max-w-[42ch] text-sm text-[var(--color-muted-foreground)]">{stageSub}</p>
          </div>
        ) : latest ? (
          <div className="flex flex-1 items-center justify-center px-4 py-6">
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

      <section className="border border-[var(--color-line)] bg-[var(--color-panel)]">
        <h3 className="border-b border-[var(--color-line)] px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--color-muted-foreground)]">
          {t(locale, "openlaunch.recent")}
        </h3>
        <div className="max-h-56 overflow-auto">
          {events.length === 0 ? (
            <FeedEmpty
              locale={locale}
              listening={feel === "listening" || feel === "connecting"}
              rows={4}
              dense
              className="min-h-[140px]"
            />
          ) : (
            <div className="divide-y divide-[rgba(30,30,46,0.9)]">
              {events.slice(0, 12).map((ev) => (
                <div key={ev.id} className="feed-row-flash flex items-start justify-between gap-3 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="font-bold text-[var(--color-neon-mag)]">{ev.kind}</div>
                    <div className="truncate font-mono text-[11px] text-[#C8CDDF]">{ev.body}</div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1">
                    {ev.tags.slice(0, 2).map((tag) => (
                      <Badge key={tag} variant="secondary" className="px-1.5 py-0.5 text-[9px]">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {settings ? (
        <>
          <Separator />
          {settings}
        </>
      ) : null}
    </div>
  );
}
