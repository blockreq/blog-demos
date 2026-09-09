import { cn } from "../utils";

export type ConnStatus = "idle" | "connecting" | "listening" | "error" | "stopped";

const STYLES: Record<ConnStatus, string> = {
  idle: "bg-slate-100 text-slate-700 border-slate-200",
  connecting: "bg-amber-50 text-amber-900 border-amber-300",
  listening: "bg-emerald-50 text-emerald-900 border-emerald-300 ring-pulse",
  error: "bg-red-50 text-red-900 border-red-300",
  stopped: "bg-slate-100 text-slate-600 border-slate-200",
};

const LABELS: Record<ConnStatus, string> = {
  idle: "Idle — press Start",
  connecting: "Connecting…",
  listening: "Listening live",
  error: "Error",
  stopped: "Stopped",
};

export function StatusPill({ status, detail }: { status: ConnStatus; detail?: string }) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-3 rounded-full border-2 px-4 py-2.5 text-base font-semibold sm:text-lg",
        STYLES[status]
      )}
      role="status"
      aria-live="polite"
    >
      <span
        className={cn(
          "h-3 w-3 rounded-full",
          status === "listening" && "bg-emerald-500 dot-pulse",
          status === "connecting" && "bg-amber-500 dot-pulse",
          status === "error" && "bg-red-500",
          (status === "idle" || status === "stopped") && "bg-slate-400"
        )}
      />
      <span>{detail || LABELS[status]}</span>
    </div>
  );
}
