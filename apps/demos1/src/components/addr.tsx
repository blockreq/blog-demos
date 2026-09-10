import { shortAddr } from "@blockreq/rpc";
import { cn } from "@blockreq/ui";

/** Truncated address with native title = full value (feel baseline .addr). */
export function Addr({
  value,
  className,
  empty = "—",
}: {
  value?: string | null;
  className?: string;
  empty?: string;
}) {
  if (!value) {
    return <span className={cn("addr", className)}>{empty}</span>;
  }
  const full = value;
  const short = shortAddr(full);
  return (
    <span className={cn("addr", className)} title={full} data-full={full}>
      {short}
    </span>
  );
}
