import type { ReactNode } from "react";
import type { Locale } from "@blockreq/i18n";
import { t } from "@blockreq/i18n";
import { Button, StatusPill, type ConnStatus } from "@blockreq/ui";
import { cn } from "@blockreq/ui";
import { toFeelState, type FeelState } from "../lib/ui-state";

export type { FeelState };

type Toast = { title: string; meta: string } | null;

const ORB: Record<FeelState, string> = {
  idle: "orb-idle",
  connecting: "orb-connecting",
  listening: "orb-listening",
  hit: "orb-hit",
};

function ctaLabel(locale: Locale, feel: FeelState): string {
  if (feel === "connecting") return t(locale, "common.starting");
  if (feel === "listening") return t(locale, "common.listening");
  if (feel === "hit") return t(locale, "common.nice");
  return t(locale, "common.start");
}

export function ListenShell({
  locale,
  status,
  hasHit,
  tag,
  title,
  heroSub,
  toast,
  onStart,
  onReset,
  children,
  settings,
}: {
  locale: Locale;
  status: ConnStatus;
  hasHit: boolean;
  tag: string;
  title: string;
  heroSub: string;
  toast: Toast;
  onStart: () => void;
  onReset: () => void;
  children?: ReactNode;
  settings?: ReactNode;
}) {
  const feel = toFeelState(status, hasHit);
  const badgeKey =
    feel === "idle"
      ? "state.idle"
      : feel === "connecting"
        ? "state.connecting"
        : feel === "listening"
          ? "state.listening"
          : "state.hit";
  const stageLabel = t(locale, `stage.${feel}.label`);
  const stageHint = t(locale, `stage.${feel}.hint`);
  const running = feel === "connecting" || feel === "listening";

  return (
    <div className="mx-auto flex w-full max-w-[420px] flex-col gap-4">
      <div
        className={cn(
          "scanlines relative flex min-h-[560px] flex-col gap-4 overflow-hidden border border-[#222236] bg-[#05050A] p-5",
          `state-${feel}`
        )}
        data-state={feel}
      >
        <div className="relative z-[1] flex items-center justify-between gap-3">
          <StatusPill status={feel} label={t(locale, badgeKey)} />
          <span className="font-mono text-[11px] font-bold tracking-[0.08em] text-[var(--color-muted-foreground)]">
            {tag}
          </span>
        </div>

        <div className="relative z-[1]">
          <h1 className="text-[clamp(28px,6.5vw,34px)] font-black leading-[1.12] tracking-[-0.03em] text-shadow-[0_0_24px_rgba(0,240,255,0.25)]">
            {title}
          </h1>
          <p className="mt-2 text-sm leading-snug text-[var(--color-muted-foreground)]">{heroSub}</p>
        </div>

        <div className="stage-sweep relative z-[1] grid min-h-[220px] flex-1 place-items-center overflow-hidden border border-[#1C1C2C] bg-[#07070E] bg-[linear-gradient(180deg,rgba(0,240,255,0.04),transparent_40%)] p-6 text-center">
          <div className="relative z-[1]">
            <div
              aria-hidden
              className={cn(
                "mx-auto mb-3 h-[112px] w-[112px] rounded-full",
                "bg-[radial-gradient(circle_at_35%_30%,#fff,#00F0FF_28%,#A23CF9_62%,#050508_78%)]",
                "shadow-[0_0_0_1px_rgba(0,240,255,0.35),0_0_40px_rgba(0,240,255,0.25)]",
                ORB[feel]
              )}
            />
            <div className="text-lg font-black tracking-wide">{stageLabel}</div>
            <div className="mt-1.5 text-[13px] text-[var(--color-muted-foreground)]">{stageHint}</div>
          </div>

          {feel === "hit" && toast && (
            <div className="toast-in absolute bottom-3 left-3 right-3 z-[2] border border-[rgba(255,43,214,0.55)] bg-[rgba(8,8,14,0.92)] p-3 text-left shadow-[0_0_24px_rgba(255,43,214,0.25)]">
              <strong className="mb-1 block text-[15px]">{toast.title}</strong>
              <span className="font-mono text-xs text-[var(--color-muted-foreground)]">{toast.meta}</span>
            </div>
          )}
        </div>

        <div className="relative z-[1] flex flex-col gap-2">
          <Button
            size="lg"
            onClick={onStart}
            disabled={running || feel === "hit"}
            aria-label={ctaLabel(locale, feel)}
          >
            {ctaLabel(locale, feel)}
          </Button>
          {feel === "hit" && (
            <Button size="lg" variant="secondary" onClick={onReset}>
              {t(locale, "common.reset")}
            </Button>
          )}
        </div>
      </div>

      {children}

      {settings}
    </div>
  );
}
