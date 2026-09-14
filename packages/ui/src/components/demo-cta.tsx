const SITE = "https://blockreq.com/";
const SIGNUP = "https://blockreq.com/pricing";

export function DemoCta({
  title,
  blogUrl,
  siteUrl = SITE,
  blogLabel = "Blog",
  siteLabel = "Site",
  friendLinksLabel = "Links",
  primarySiteLabel,
  readLabel,
  pricingLabel = "Pricing →",
  quotaLabel = "public endpoints",
}: {
  title: string;
  blogUrl: string;
  /** Optional primary/demo site CTA (e.g. messier). Friend Site always uses blockreq.com. */
  siteUrl?: string;
  blogLabel?: string;
  /** Friend Site label (Blog/Site / 官网) */
  siteLabel?: string;
  friendLinksLabel?: string;
  /** Optional primary site button label; uses siteUrl — prefer quiet Site/官网 if set */
  primarySiteLabel?: string;
  /** @deprecated friend Blog uses blogLabel — kept so old call sites compile */
  readLabel?: string;
  pricingLabel?: string;
  /** Post-signup quota — never imply free-without-account */
  quotaLabel?: string;
  /** @deprecated use quotaLabel — kept so old call sites compile during rollout */
  freeLabel?: string;
}) {
  void readLabel;
  const showPrimarySite = Boolean(primarySiteLabel && siteUrl);

  return (
    <footer className="fixed inset-x-0 bottom-0 z-40 overflow-x-hidden border-t border-[var(--color-line)] bg-[rgba(5,5,8,0.94)] backdrop-blur">
      <div className="mx-auto flex w-full min-w-0 max-w-[1280px] flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-[var(--color-foreground)]">{title}</p>
          <p className="truncate font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--color-muted-foreground)]">
            BlockReq · {quotaLabel} · no wallet
          </p>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
          <nav
            className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1"
            aria-label={friendLinksLabel}
          >
            <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--color-muted-foreground)]">
              {friendLinksLabel}
            </span>
            <a
              href={blogUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-9 min-w-0 items-center justify-center border border-[var(--color-line)] bg-[var(--color-panel)] px-3 text-sm font-bold text-[var(--color-foreground)] hover:border-[rgba(0,240,255,0.45)]"
            >
              {blogLabel}
            </a>
            <a
              href={SITE}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-9 min-w-0 items-center justify-center border border-[rgba(57,255,154,0.45)] bg-[rgba(57,255,154,0.08)] px-3 text-sm font-bold text-[var(--color-ok)] hover:brightness-110"
            >
              {siteLabel}
            </a>
          </nav>

          {showPrimarySite ? (
            <a
              href={siteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 min-w-0 items-center justify-center border border-[rgba(57,255,154,0.45)] bg-[rgba(57,255,154,0.08)] px-4 text-sm font-bold text-[var(--color-ok)] hover:brightness-110"
            >
              {primarySiteLabel}
            </a>
          ) : null}

          <a
            href={SIGNUP}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-9 min-w-0 shrink-0 items-center justify-center border border-transparent px-3 text-xs font-medium text-[var(--color-muted-foreground)] opacity-60 hover:opacity-100 hover:border-[var(--color-line)] hover:text-[var(--color-neon-cyan)]"
          >
            {pricingLabel}
          </a>
        </div>
      </div>
    </footer>
  );
}
