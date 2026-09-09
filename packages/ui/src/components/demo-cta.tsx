const SIGNUP = "https://blockreq.com/pricing";

export function DemoCta({
  title,
  blogUrl,
  readLabel = "Read the guide",
  pricingLabel = "Pricing →",
}: {
  title: string;
  blogUrl: string;
  readLabel?: string;
  pricingLabel?: string;
}) {
  return (
    <footer className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-line)] bg-[rgba(5,5,8,0.94)] backdrop-blur">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-[var(--color-foreground)]">{title}</p>
          <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--color-muted-foreground)]">
            Public demo · no wallet
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <a
            href={blogUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center justify-center border border-[var(--color-line)] bg-[var(--color-panel)] px-4 text-sm font-bold text-[var(--color-foreground)] hover:border-[rgba(0,240,255,0.45)]"
          >
            {readLabel}
          </a>
          <a
            href={SIGNUP}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center justify-center border border-[rgba(0,240,255,0.55)] bg-[rgba(0,240,255,0.12)] px-5 text-sm font-bold text-[var(--color-neon-cyan)] hover:brightness-110"
          >
            {pricingLabel}
          </a>
        </div>
      </div>
    </footer>
  );
}
