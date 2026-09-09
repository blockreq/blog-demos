import type { Locale } from "@blockreq/i18n";
import { t } from "@blockreq/i18n";
import { Badge, cn } from "@blockreq/ui";

/** Top guidance: BlockReq public endpoint + step hints (tool-oriented, not tutorial). */
export function ToolGuideBanner({
  locale,
  stepHint,
  className,
}: {
  locale: Locale;
  /** Product-specific guidance — live-default, never 「开始盯」 */
  stepHint: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 border border-[rgba(0,240,255,0.28)] bg-[rgba(0,240,255,0.06)] px-3 py-2",
        className
      )}
      role="status"
    >
      <Badge variant="ok">{t(locale, "tool.publicFree")}</Badge>
      <span className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--color-neon-cyan)]">
        {t(locale, "tool.guideLine")}
      </span>
      <span className="text-xs text-[var(--color-muted-foreground)] sm:ml-1">{stepHint}</span>
    </div>
  );
}
