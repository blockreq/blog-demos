const SITE = "https://blockreq.com/";
const SIGNUP = "https://blockreq.com/pricing";

export function DemoCta({
  title,
  blogUrl,
  siteUrl = SITE,
  readLabel = "Read the guide",
  siteLabel = "Site",
  pricingLabel = "Pricing →",
  quotaLabel = "Free 3M after signup",
}: {
  title: string;
  blogUrl: string;
  siteUrl?: string;
  readLabel?: string;
  siteLabel?: string;
  pricingLabel?: string;
  /** Post-signup quota — never imply free-without-account */
  quotaLabel?: string;
  /** @deprecated use quotaLabel — kept so old call sites compile during rollout */
  freeLabel?: string;
}) {
  return (
    <footer className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-line)] bg-[rgba(5,5,8,0.94)] backdrop-blur">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-[var(--color-foreground)]">{title}</p>
          <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--color-muted-foreground)]">
            BlockReq public endpoint · {quotaLabel} · no wallet
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
            href={siteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center justify-center border border-[rgba(57,255,154,0.45)] bg-[rgba(57,255,154,0.08)] px-4 text-sm font-bold text-[var(--color-ok)] hover:brightness-110"
          >
            {siteLabel}
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
