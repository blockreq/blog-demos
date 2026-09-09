import type { Locale } from "@blockreq/i18n";
import { t } from "@blockreq/i18n";
import {
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  cn,
} from "@blockreq/ui";
import type { FeedEvent } from "./feed-types";
import { FeedSkeletonRows, HeartbeatStrip } from "./feed-empty";
import type { HistoryState } from "../lib/recent-history";

function ageLabel(at: number) {
  const s = Math.max(0, Math.floor((Date.now() - at) / 1000));
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m`;
}

/**
 * Dense history/feed table.
 * Priority: liveEvents → rpc history → seedEvents (labeled 示意数据).
 * Never a blank void; 「暂无记录」+ reason only when all empty.
 */
export function RecentHistoryPanel({
  locale,
  history,
  liveEvents,
  seedEvents = [],
  listening,
  selectedId,
  onSelect,
  dense,
  title,
  className,
}: {
  locale: Locale;
  history: HistoryState;
  liveEvents: FeedEvent[];
  /** First-paint DEMO DATA rows when RPC empty */
  seedEvents?: FeedEvent[];
  listening: boolean;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  dense?: boolean;
  title?: string;
  className?: string;
}) {
  const usingLive = liveEvents.length > 0;
  const usingRpc = !usingLive && history.events.length > 0;
  const usingSeed = !usingLive && !usingRpc && seedEvents.length > 0;
  const rows = usingLive ? liveEvents : usingRpc ? history.events : seedEvents;
  const showEmpty =
    !usingLive &&
    !usingRpc &&
    !usingSeed &&
    (history.status === "empty" || history.status === "error" || history.status === "ready");
  const showLoading = !usingLive && !usingSeed && history.status === "loading" && !usingRpc;

  const heading = title
    ? title
    : usingLive
      ? t(locale, "history.liveTitle")
      : usingSeed
        ? t(locale, "anoncoin.histTitle")
        : t(locale, "history.title");

  return (
    <div
      className={cn(
        "flex min-h-[180px] flex-col border border-[var(--color-line)] bg-[var(--color-panel)]",
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-line)] px-3 py-2">
        <h3 className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--color-muted-foreground)]">
          {heading}
        </h3>
        {usingSeed ? <span className="demo-seed">{t(locale, "common.seedLabel")}</span> : null}
        {usingRpc ? (
          <Badge variant="secondary" className="text-[9px]">
            {t(locale, "history.windowBadge").replace("{n}", String(history.windowBlocks || 900))}
          </Badge>
        ) : null}
        {usingLive ? (
          <Badge variant="live">LIVE</Badge>
        ) : null}
        {typeof history.toBlock === "number" && usingRpc ? (
          <span className="font-mono text-[10px] text-[var(--color-muted-foreground)]">
            #{history.fromBlock}–#{history.toBlock}
          </span>
        ) : null}
      </div>

      {showLoading ? (
        <div className="flex-1">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[52px]">{t(locale, "history.colAge")}</TableHead>
                <TableHead>{t(locale, "history.colEvent")}</TableHead>
                <TableHead className="hidden sm:table-cell">{t(locale, "history.colBlock")}</TableHead>
                <TableHead className="text-right">{t(locale, "history.colTags")}</TableHead>
              </TableRow>
            </TableHeader>
          </Table>
          {/* Secondary loading only — seeds usually already fill the panel */}
          <FeedSkeletonRows rows={dense ? 3 : 4} dense={dense} />
          <p className="px-3 py-2 font-mono text-[10px] text-[var(--color-muted-foreground)]">
            {t(locale, "history.loading")}
          </p>
        </div>
      ) : showEmpty ? (
        <div className="flex flex-1 flex-col">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[52px]">{t(locale, "history.colAge")}</TableHead>
                <TableHead>{t(locale, "history.colEvent")}</TableHead>
                <TableHead className="hidden sm:table-cell">{t(locale, "history.colBlock")}</TableHead>
                <TableHead className="text-right">{t(locale, "history.colTags")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center">
                  <p className="text-[15px] font-extrabold text-[var(--color-foreground)]">
                    {t(locale, "history.none")}
                  </p>
                  <p className="mx-auto mt-1.5 max-w-[48ch] text-xs text-[var(--color-muted-foreground)]">
                    {history.reason || t(locale, "history.emptyFallback")}
                  </p>
                </TableCell>
              </TableRow>
              <TableRow className="opacity-50">
                <TableCell className="font-mono text-[10px] text-[var(--color-muted-foreground)]">—</TableCell>
                <TableCell>
                  <span className="text-xs text-[var(--color-muted-foreground)]">
                    {t(locale, "history.placeholderHint")}
                  </span>
                </TableCell>
                <TableCell className="hidden font-mono text-[10px] text-[var(--color-muted-foreground)] sm:table-cell">
                  #
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant="secondary" className="text-[9px]">
                    WAIT
                  </Badge>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <HeartbeatStrip locale={locale} active={listening} className="mt-auto" />
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          {usingSeed ? (
            <p className="border-b border-[var(--color-line)] px-3 py-1.5 text-[10px] text-[var(--color-muted-foreground)]">
              {t(locale, "history.seedNote")}
            </p>
          ) : usingRpc ? (
            <p className="border-b border-[var(--color-line)] px-3 py-1.5 text-[10px] text-[var(--color-muted-foreground)]">
              {t(locale, "history.rpcNote")}
            </p>
          ) : null}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[52px]">{t(locale, "history.colAge")}</TableHead>
                <TableHead>{t(locale, "history.colEvent")}</TableHead>
                <TableHead className="hidden sm:table-cell">{t(locale, "history.colBlock")}</TableHead>
                <TableHead className="text-right">{t(locale, "history.colTags")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice(0, 40).map((ev) => {
                const active = selectedId === ev.id;
                const clickable = !!onSelect;
                return (
                  <TableRow
                    key={ev.id}
                    data-state={active ? "selected" : undefined}
                    className={cn(clickable && "cursor-pointer", usingLive && "feed-row-flash")}
                    onClick={clickable ? () => onSelect?.(ev.id) : undefined}
                  >
                    <TableCell className="font-mono text-[10px] text-[var(--color-muted-foreground)]">
                      {usingLive || usingSeed ? ageLabel(ev.at) : `#${ev.block ?? "—"}`}
                    </TableCell>
                    <TableCell className="min-w-0">
                      <div className="truncate text-[13px] font-extrabold">{ev.title || ev.kind}</div>
                      <div className="mt-0.5 truncate font-mono text-[10px] text-[var(--color-muted-foreground)]">
                        {ev.body}
                      </div>
                    </TableCell>
                    <TableCell className="hidden font-mono text-[11px] sm:table-cell">
                      {typeof ev.block === "number" ? `#${ev.block}` : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="inline-flex flex-wrap justify-end gap-1">
                        {ev.tags.slice(0, 2).map((tag) => (
                          <Badge key={tag} variant="secondary" className="px-1.5 py-0.5 text-[9px]">
                            {tag}
                          </Badge>
                        ))}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <HeartbeatStrip locale={locale} active={listening} className="mt-auto" />
        </div>
      )}
    </div>
  );
}
