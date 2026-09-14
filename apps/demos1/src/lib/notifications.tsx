import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { t, type Locale } from "@blockreq/i18n";
import { cn } from "@blockreq/ui";
import type { FeedEvent } from "../components/feed-types";

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
  /** Also fire a browser Notification when user enabled + permission granted. */
  browser?: boolean;
};

type BrowserNotifApi = {
  /** User preference (localStorage) — wants browser notifications. */
  browserPref: boolean;
  /** Notification.permission when available. */
  permission: NotificationPermission | "unsupported";
  enableBrowserNotifs: () => Promise<NotificationPermission | "unsupported">;
  disableBrowserNotifs: () => void;
  testBrowserNotif: () => void;
  /** Fire browser Notification if pref on + granted (page must be open). */
  notifyBrowser: (input: { title: string; body?: string }) => void;
};

type NotifApi = {
  items: DemoNotif[];
  pushNotif: (input: PushInput) => string;
  dismissNotif: (id: string) => void;
  clearNotifs: () => void;
  reportRpcError: (err: unknown) => void;
} & BrowserNotifApi;

const NotifCtx = createContext<NotifApi | null>(null);

const MAX_ITEMS = 8;
const LS_BROWSER = "blockreq.demos1.browserNotif";

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

function readBrowserPref(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(LS_BROWSER) === "1";
  } catch {
    return false;
  }
}

function writeBrowserPref(on: boolean) {
  try {
    localStorage.setItem(LS_BROWSER, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function currentPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return "unsupported";
  }
  return Notification.permission;
}

function fireBrowserNotification(title: string, body?: string) {
  if (typeof window === "undefined" || typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  try {
    const n = new Notification(title, {
      body: body || undefined,
      silent: false,
    });
    window.setTimeout(() => {
      try {
        n.close();
      } catch {
        /* ignore */
      }
    }, 8000);
  } catch {
    /* ignore */
  }
}

export function DemoNotifProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<DemoNotif[]>([]);
  const [browserPref, setBrowserPref] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    "unsupported"
  );

  useEffect(() => {
    setBrowserPref(readBrowserPref());
    setPermission(currentPermission());
  }, []);

  const dismissNotif = useCallback((id: string) => {
    setItems((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const notifyBrowser = useCallback(
    (input: { title: string; body?: string }) => {
      if (!browserPref) return;
      if (currentPermission() !== "granted") return;
      fireBrowserNotification(input.title, input.body);
    },
    [browserPref]
  );

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
      if (input.browser) {
        notifyBrowser({ title: input.title, body: input.body });
      }
      return id;
    },
    [dismissNotif, notifyBrowser]
  );

  const clearNotifs = useCallback(() => setItems([]), []);

  const enableBrowserNotifs = useCallback(async () => {
    if (typeof window === "undefined" || typeof Notification === "undefined") {
      setPermission("unsupported");
      return "unsupported" as const;
    }
    let perm = Notification.permission;
    if (perm === "default") {
      try {
        perm = await Notification.requestPermission();
      } catch {
        perm = Notification.permission;
      }
    }
    setPermission(perm);
    if (perm === "granted") {
      writeBrowserPref(true);
      setBrowserPref(true);
    } else {
      writeBrowserPref(false);
      setBrowserPref(false);
    }
    return perm;
  }, []);

  const disableBrowserNotifs = useCallback(() => {
    writeBrowserPref(false);
    setBrowserPref(false);
  }, []);

  const testBrowserNotif = useCallback(() => {
    const locale = pathLocale();
    const title = t(locale, "notif.browserTestTitle");
    const body = t(locale, "notif.browserNeedOpen");
    pushNotif({ tone: "ok", title, body, ttlMs: 5000 });
    if (currentPermission() === "granted") {
      fireBrowserNotification(title, body);
    }
  }, [pushNotif]);

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
    () => ({
      items,
      pushNotif,
      dismissNotif,
      clearNotifs,
      reportRpcError,
      browserPref,
      permission,
      enableBrowserNotifs,
      disableBrowserNotifs,
      testBrowserNotif,
      notifyBrowser,
    }),
    [
      items,
      pushNotif,
      dismissNotif,
      clearNotifs,
      reportRpcError,
      browserPref,
      permission,
      enableBrowserNotifs,
      disableBrowserNotifs,
      testBrowserNotif,
      notifyBrowser,
    ]
  );

  return (
    <NotifCtx.Provider value={api}>
      {children}
      <DemoNotifToasts items={items} onDismiss={dismissNotif} />
    </NotifCtx.Provider>
  );
}

const NOOP_API: NotifApi = {
  items: [],
  pushNotif: () => "",
  dismissNotif: () => undefined,
  clearNotifs: () => undefined,
  reportRpcError: () => undefined,
  browserPref: false,
  permission: "unsupported",
  enableBrowserNotifs: async () => "unsupported",
  disableBrowserNotifs: () => undefined,
  testBrowserNotif: () => undefined,
  notifyBrowser: () => undefined,
};

export function useDemoNotifs(): NotifApi {
  const ctx = useContext(NotifCtx);
  return ctx || NOOP_API;
}

/**
 * When a new live feed event arrives, push in-app toast + optional browser Notification.
 * Shared by listen layouts so demos get browser hits without per-demo wiring.
 */
export function useLiveHitBrowserNotify({
  locale,
  liveEvent,
  enabled,
}: {
  locale: Locale;
  liveEvent: FeedEvent | null;
  enabled?: boolean;
}) {
  const { pushNotif, notifyBrowser } = useDemoNotifs();
  const lastId = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !liveEvent?.id) return;
    if (lastId.current === liveEvent.id) return;
    // Skip first mount seed flash — only fire after we already saw an id (or tags include NEW).
    const isNew = liveEvent.tags?.includes("NEW");
    if (lastId.current == null && !isNew) {
      lastId.current = liveEvent.id;
      return;
    }
    lastId.current = liveEvent.id;
    const title =
      liveEvent.title || liveEvent.kind || t(locale, "notif.browserHitTitle");
    const body = liveEvent.body?.slice(0, 160);
    pushNotif({ tone: "ok", title, body, ttlMs: 4500 });
    notifyBrowser({ title, body });
  }, [enabled, liveEvent, locale, pushNotif, notifyBrowser]);
}

/** Compact enable + test controls for topbar / LiveToggle row. */
export function BrowserNotifControls({
  locale,
  className,
}: {
  locale: Locale;
  className?: string;
}) {
  const {
    browserPref,
    permission,
    enableBrowserNotifs,
    disableBrowserNotifs,
    testBrowserNotif,
  } = useDemoNotifs();

  const statusLabel =
    permission === "unsupported"
      ? t(locale, "notif.browserUnsupported")
      : permission === "denied"
        ? t(locale, "notif.browserDenied")
        : browserPref && permission === "granted"
          ? t(locale, "notif.browserGranted")
          : t(locale, "notif.browserNeedOpen");

  return (
    <div
      className={cn("flex flex-wrap items-center gap-1.5", className)}
      title={statusLabel}
    >
      <button
        type="button"
        className={cn(
          "inline-flex h-8 items-center border px-2 font-mono text-[10px] font-bold uppercase tracking-[0.06em]",
          browserPref && permission === "granted"
            ? "border-[rgba(57,255,154,0.45)] bg-[rgba(8,28,18,0.85)] text-[#9CFFC9]"
            : "border-[var(--color-line)] bg-[var(--color-panel)] text-[var(--color-muted-foreground)] hover:border-[rgba(0,240,255,0.45)] hover:text-[var(--color-neon-cyan)]"
        )}
        onClick={() => {
          if (browserPref && permission === "granted") {
            disableBrowserNotifs();
          } else {
            void enableBrowserNotifs();
          }
        }}
      >
        {browserPref && permission === "granted"
          ? t(locale, "notif.browserOn")
          : t(locale, "notif.browserEnable")}
      </button>
      <button
        type="button"
        className="inline-flex h-8 items-center border border-[var(--color-line)] bg-[var(--color-panel)] px-2 font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--color-muted-foreground)] hover:border-[rgba(0,240,255,0.45)] hover:text-[var(--color-neon-cyan)]"
        onClick={() => testBrowserNotif()}
      >
        {t(locale, "notif.browserTest")}
      </button>
    </div>
  );
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
