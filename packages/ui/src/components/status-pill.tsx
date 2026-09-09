import { cn } from "../utils";

/** Connection + event UI states matching feel baseline. */
export type ConnStatus = "idle" | "connecting" | "listening" | "hit" | "error" | "stopped";

const STYLES: Record<ConnStatus, string> = {
  idle: "text-[#7A8098] border-[#2A2A3A] bg-[#0C0C14]",
  connecting: "text-[var(--color-warn)] border-[rgba(255,209,102,0.55)] bg-[rgba(255,209,102,0.08)]",
  listening: "text-[var(--color-ok)] border-[rgba(57,255,154,0.55)] bg-[rgba(57,255,154,0.08)]",
  hit: "text-white border-[rgba(255,43,214,0.8)] bg-[linear-gradient(90deg,rgba(85,124,242,0.35),rgba(255,43,214,0.45))] shadow-[0_0_22px_rgba(255,43,214,0.35)]",
  error: "text-[#FF8FAB] border-[rgba(255,43,214,0.45)] bg-[rgba(255,43,214,0.08)]",
  stopped: "text-[#7A8098] border-[#2A2A3A] bg-[#0C0C14]",
};

const LABELS: Record<ConnStatus, string> = {
  idle: "Not connected",
  connecting: "Connecting",
  listening: "Listening",
  hit: "Got one!",
  error: "Error",
  stopped: "Stopped",
};

export function StatusPill({
  status,
  detail,
  label,
}: {
  status: ConnStatus;
  detail?: string;
  /** Override badge text (locale-aware). */
  label?: string;
}) {
  const visual: ConnStatus =
    status === "stopped" ? "idle" : status === "error" ? "error" : status;
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 border px-3 py-2 font-mono text-xs font-extrabold uppercase tracking-[0.04em]",
        STYLES[visual]
      )}
      role="status"
      aria-live="polite"
    >
      <span
        className={cn(
          "h-2 w-2 rounded-full bg-current shadow-[0_0_10px_currentColor]",
          (status === "connecting" || status === "listening") && "dot-pulse"
        )}
      />
      <span>{label || detail || LABELS[status]}</span>
    </div>
  );
}
