import * as React from "react";
import { cn } from "../utils";
import { ScrollArea } from "./scroll-area";

export type DemoTerminalLine = {
  id: string;
  ts?: string;
  text: string;
  tone?: "default" | "ok" | "warn" | "hit" | "muted";
};

const TONE: Record<NonNullable<DemoTerminalLine["tone"]>, string> = {
  default: "text-[#C8CDDF]",
  ok: "text-[var(--color-ok)]",
  warn: "text-[var(--color-warn)]",
  hit: "text-[var(--color-neon-mag)]",
  muted: "text-[var(--color-muted-foreground)]",
};

export function DemoTerminal({
  title = "Scan activity",
  lines,
  className,
  defaultOpen = true,
  emptyLabel = "No events yet.",
}: {
  title?: string;
  lines: DemoTerminalLine[];
  className?: string;
  defaultOpen?: boolean;
  emptyLabel?: string;
}) {
  return (
    <details
      open={defaultOpen}
      className={cn(
        "border border-[var(--color-line)] bg-[var(--color-panel)] open:[&_summary]:border-b open:[&_summary]:border-[var(--color-line)] open:[&_summary]:text-[var(--color-neon-cyan)]",
        className
      )}
    >
      <summary className="cursor-pointer list-none px-3 py-2 font-mono text-xs font-bold uppercase tracking-[0.08em] text-[var(--color-muted-foreground)] marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="inline-flex w-full items-center justify-between gap-2">
          <span>{title}</span>
          <span className="text-[10px] opacity-70">▾</span>
        </span>
      </summary>
      <ScrollArea className="h-[140px]">
        <div className="space-y-1 p-3 font-mono text-[11px] leading-relaxed">
          {lines.length === 0 ? (
            <p className="text-[var(--color-muted-foreground)]">{emptyLabel}</p>
          ) : (
            lines.map((line) => (
              <div key={line.id} className={cn("break-all", TONE[line.tone || "default"])}>
                {line.ts ? <span className="mr-2 text-[var(--color-muted-foreground)]">{line.ts}</span> : null}
                {line.text}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </details>
  );
}
