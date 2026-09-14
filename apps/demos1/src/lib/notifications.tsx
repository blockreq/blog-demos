import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { t, type Locale } from "@blockreq/i18n";
import { cn } from "@blockreq/ui";

export type NotifTone = "info" | "warn" | "error" | "ok";

export type DemoNotif = {
  id: string;
  tone: NotifTone;
  title: string;
  body?: string;
  at: number;
};

type PushInput = {
  tone?: NotifTone;
  title: string;
  body?: string;
  /** Auto-dismiss ms; 0 = sticky until dismissed. Default 6500. */
  ttlMs?: number;
};

type NotifApi = {
  items: DemoNotif[];
  pushNotif: (input: PushInput) => string;
  dismissNotif: (id: string) => void;
  clearNotifs: () => void;
  reportRpcError: (err: unknown) => void;
};

const NotifCtx = createContext<NotifApi | null>(null);

const MAX_ITEMS = 8;

function looksRateLimited(text: string) {
  const s = text.toLowerCase();
  return (
    s.includes("429") ||
    s.includes("rate limit") ||
    s.includes("ratelimit") ||
    s.includes("too many requests") ||
    s.includes("quota exceeded")
  );
}

function errText(err: unknown): string {
  if (err == null) return "";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message || String(err);
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

let seq = 0;

function pathLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const parts = window.location.pathname.split("/").filter(Boolean);
  const last = parts[parts.length - 1] || "";
  const maybe = parts[parts.length - 2] || last;
  if (last === "zh" || maybe === "zh") return "zh";
  return "en";
}

export function DemoNotifProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<DemoNotif[]>([]);

  const dismissNotif = useCallback((id: string) => {
    setItems((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const pushNotif = useCallback(
    (input: PushInput) => {
      const id = `n-${Date.now()}-${++seq}`;
      const ttl = input.ttlMs === undefined ? 6500 : input.ttlMs;
      const next: DemoNotif = {
        id,
        tone: input.tone || "info",
        title: input.title,
        body: input.body,
        at: Date.now(),
      };
      setItems((prev) => [next, ...prev].slice(0, MAX_ITEMS));
      if (ttl > 0 && typeof window !== "undefined") {
        window.setTimeout(() => dismissNotif(id), ttl);
      }
      return id;
    },
    [dismissNotif]
  );

  const clearNotifs = useCallback(() => setItems([]), []);

  const reportRpcError = useCallback(
    (err: unknown) => {
      const locale = pathLocale();
      const text = errText(err);
      if (looksRateLimited(text)) {
        pushNotif({
          tone: "warn",
          title: t(locale, "notif.rateLimitTitle"),
          body: t(locale, "notif.rateLimitBody"),
          ttlMs: 9000,
        });
        return;
      }
      pushNotif({
        tone: "error",
        title: t(locale, "notif.connFailTitle"),
        body: text ? text.slice(0, 180) : t(locale, "notif.connFailBody"),
        ttlMs: 8000,
      });
    },
    [pushNotif]
  );

  const api = useMemo(
    () => ({ items, pushNotif, dismissNotif, clearNotifs, reportRpcError }),
    [items, pushNotif, dismissNotif, clearNotifs, reportRpcError]
  );

  return (
    <NotifCtx.Provider value={api}>
      {children}
      <DemoNotifToasts items={items} onDismiss={dismissNotif} />
    </NotifCtx.Provider>
  );
}

export function useDemoNotifs(): NotifApi {
  const ctx = useContext(NotifCtx);
  if (!ctx) {
    // Safe no-op outside provider (tests / story)
    return {
      items: [],
      pushNotif: () => "",
      dismissNotif: () => undefined,
      clearNotifs: () => undefined,
      reportRpcError: () => undefined,
    };
  }
  return ctx;
}

function toneClass(tone: NotifTone) {
  if (tone === "error") return "border-[rgba(255,80,80,0.55)] bg-[rgba(40,8,12,0.96)] text-[#FFB4B4]";
  if (tone === "warn") return "border-[rgba(255,209,102,0.55)] bg-[rgba(28,22,8,0.96)] text-[#FFE08A]";
  if (tone === "ok") return "border-[rgba(57,255,154,0.45)] bg-[rgba(8,28,18,0.96)] text-[#9CFFC9]";
  return "border-[rgba(0,240,255,0.4)] bg-[rgba(6,14,22,0.96)] text-[var(--color-neon-cyan)]";
}

function DemoNotifToasts({
  items,
  onDismiss,
}: {
  items: DemoNotif[];
  onDismiss: (id: string) => void;
}) {
  if (!items.length) return null;
  return (
    <div
      className="pointer-events-none fixed right-3 top-3 z-[80] flex w-[min(360px,calc(100vw-1.5rem))] flex-col gap-2"
      aria-live="polite"
      aria-relevant="additions"
    >
      {items.slice(0, 4).map((n) => (
        <div
          key={n.id}
          className={cn(
            "pointer-events-auto border px-3 py-2.5 shadow-[0_8px_28px_rgba(0,0,0,0.45)] backdrop-blur",
            toneClass(n.tone)
          )}
          role="status"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="font-mono text-[11px] font-extrabold uppercase tracking-[0.08em]">{n.title}</p>
            <button
              type="button"
              className="font-mono text-[10px] font-bold text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
              onClick={() => onDismiss(n.id)}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
          {n.body ? (
            <p className="mt-1 text-[12px] leading-snug text-[var(--color-foreground)]/90">{n.body}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/** Compact bell in top-right chrome — expands recent list. */
export function NotifBell({
  localeLabel,
  emptyLabel,
}: {
  localeLabel: string;
  emptyLabel: string;
}) {
  const { items, dismissNotif, clearNotifs } = useDemoNotifs();
  const [open, setOpen] = useState(false);
  const unread = items.length;

  return (
    <div className="relative">
      <button
        type="button"
        className={cn(
          "inline-flex h-8 min-w-8 items-center justify-center border border-[var(--color-line)] bg-[var(--color-panel)] px-2 font-mono text-[11px] font-bold text-[var(--color-muted-foreground)] hover:border-[rgba(0,240,255,0.45)] hover:text-[var(--color-neon-cyan)]",
          unread > 0 && "border-[rgba(255,43,214,0.45)] text-[var(--color-neon-mag)]"
        )}
        aria-label={localeLabel}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        ⌁{unread > 0 ? <span className="ml-1">{Math.min(unread, 9)}</span> : null}
      </button>
      {open ? (
        <div className="absolute right-0 top-[calc(100%+6px)] z-[90] w-[min(320px,calc(100vw-1.5rem))] border border-[var(--color-line)] bg-[rgba(8,8,14,0.98)] p-2 shadow-xl">
          <div className="mb-1.5 flex items-center justify-between gap-2 px-1">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--color-muted-foreground)]">
              {localeLabel}
            </span>
            {items.length ? (
              <button
                type="button"
                className="font-mono text-[10px] text-[var(--color-muted-foreground)] hover:text-[var(--color-neon-cyan)]"
                onClick={() => clearNotifs()}
              >
                clear
              </button>
            ) : null}
          </div>
          {!items.length ? (
            <p className="px-1 py-3 text-center text-[12px] text-[var(--color-muted-foreground)]">{emptyLabel}</p>
          ) : (
            <ul className="max-h-[240px] space-y-1.5 overflow-auto">
              {items.map((n) => (
                <li
                  key={n.id}
                  className={cn("border px-2 py-1.5", toneClass(n.tone))}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-mono text-[10px] font-bold uppercase tracking-[0.06em]">{n.title}</p>
                    <button
                      type="button"
                      className="text-[10px] text-[var(--color-muted-foreground)]"
                      onClick={() => dismissNotif(n.id)}
                    >
                      ×
                    </button>
                  </div>
                  {n.body ? <p className="mt-0.5 text-[11px] leading-snug opacity-90">{n.body}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
