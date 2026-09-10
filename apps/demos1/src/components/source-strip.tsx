import { cn } from "@blockreq/ui";

export type SourceItem = { k: string; v: string };

/** Compact source meta strip (chain / method / window / endpoint). */
export function SourceStrip({
  items,
  className,
}: {
  items: SourceItem[];
  className?: string;
}) {
  return (
    <div className={cn("source-strip", className)}>
      {items.map((it) => (
        <span key={it.k} className="min-w-0">
          <span className="sk">{it.k}</span>
          <span className={it.v.startsWith("0x") || it.v.startsWith("wss") || it.v.startsWith("http") ? "sv truncate addr" : "sv truncate"} title={it.v}>
            {it.v}
          </span>
        </span>
      ))}
    </div>
  );
}
