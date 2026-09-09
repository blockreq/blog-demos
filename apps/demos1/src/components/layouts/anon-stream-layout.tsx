import type { ReactNode } from "react";
import type { Locale } from "@blockreq/i18n";
import { t } from "@blockreq/i18n";
import { Badge, Button, ScrollArea, Separator, cn } from "@blockreq/ui";
import type { FeedEvent } from "../feed-types";

function ageLabel(at: number) {
  const s = Math.max(0, Math.floor((Date.now() - at) / 1000));
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m`;
}

export function AnonStreamLayout({
  locale,
  events,
  selectedId,
  onSelect,
  onStart,
  onStop,
  running,
  connecting,
  settings,
  chainBadge = "RH",
}: {
  locale: Locale;
  events: FeedEvent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onStart: () => void;
  onStop: () => void;
  running: boolean;
  connecting: boolean;
  settings?: ReactNode;
  chainBadge?: string;
}) {
  const selected = events.find((e) => e.id === selectedId) || events[0] || null;

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-3 p-3">
      <div className="grid flex-1 gap-3 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="flex min-h-0 flex-col">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {!running ? (
              <Button size="sm" onClick={onStart} disabled={connecting} className="min-h-10 w-auto clip-cta">
                {connecting ? t(locale, "common.starting") : t(locale, "common.start")}
              </Button>
            ) : (
              <Button size="sm" variant="secondary" onClick={onStop} className="min-h-10 w-auto">
                {t(locale, "common.stop")}
              </Button>
            )}
            <Badge variant="ok">{chainBadge}</Badge>
            <span className="text-xs text-[var(--color-muted-foreground)]">{t(locale, "anoncoin.hint")}</span>
          </div>
          <ScrollArea className="min-h-[280px] flex-1 border border-[var(--color-line)] bg-[var(--color-panel)]">
            <div>
              {events.length === 0 ? (
                <p className="p-4 text-sm text-[var(--color-muted-foreground)]">{t(locale, "common.waiting")}</p>
              ) : (
                events.map((ev) => {
                  const active = selected?.id === ev.id;
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => onSelect(ev.id)}
                      className={cn(
                        "feed-row-flash grid w-full grid-cols-[52px_1fr_auto] items-center gap-2 border-b border-[rgba(30,30,46,0.9)] px-2.5 py-2 text-left hover:bg-[rgba(0,240,255,0.04)]",
                        active && "bg-[rgba(255,43,214,0.08)] shadow-[inset_3px_0_0_var(--color-neon-mag)]"
                      )}
                    >
                      <span className="text-right font-mono text-[10px] text-[var(--color-muted-foreground)]">
                        {ageLabel(ev.at)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-extrabold">{ev.title || ev.kind}</span>
                        <span className="mt-0.5 block truncate font-mono text-[10px] text-[var(--color-muted-foreground)]">
                          {ev.body}
                        </span>
                      </span>
                      <span className="flex flex-wrap justify-end gap-1">
                        {ev.tags.slice(0, 2).map((tag) => (
                          <Badge key={tag} variant="secondary" className="px-1.5 py-0.5 text-[9px]">
                            {tag}
                          </Badge>
                        ))}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </section>

        <aside className="flex min-h-0 flex-col">
          <div
            className={cn(
              "sticky top-0 flex min-h-[280px] flex-1 flex-col gap-2.5 border border-[var(--color-line)] bg-[var(--color-panel)] p-3.5",
              selected && "hit-panel-flash"
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
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="hit">{t(locale, "anoncoin.latest")}</Badge>
                  <span className="font-mono text-[10px] text-[var(--color-muted-foreground)]">{ageLabel(selected.at)}</span>
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
