import { useState } from "react";
import type { Locale } from "@blockreq/i18n";
import { t } from "@blockreq/i18n";
import { Badge, Button, cn } from "@blockreq/ui";

const DOCS = "https://docs.blockreq.com/build/public-endpoints/";
const PRICING = "https://blockreq.com/pricing";

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function EndpointBar({
  locale,
  wss,
  https,
  chainLabel,
  className,
}: {
  locale: Locale;
  wss: string;
  https: string;
  chainLabel: string;
  className?: string;
}) {
  const [copied, setCopied] = useState<"wss" | "https" | null>(null);

  const onCopy = async (which: "wss" | "https", value: string) => {
    const ok = await copyText(value);
    if (!ok) return;
    setCopied(which);
    window.setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div
      className={cn(
        "border border-[rgba(0,240,255,0.28)] bg-[rgba(0,240,255,0.05)] px-3 py-2.5",
        className
      )}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge variant="ok">{chainLabel}</Badge>
        <span className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--color-neon-cyan)]">
          {t(locale, "endpoint.public")}
        </span>
        <a
          href={DOCS}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-[11px] font-bold text-[var(--color-neon-cyan)] underline-offset-2 hover:underline"
        >
          {t(locale, "endpoint.free3m")}
        </a>
        <a
          href={PRICING}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto font-mono text-[11px] font-bold text-[var(--color-muted-foreground)] hover:text-[var(--color-neon-cyan)]"
        >
          {t(locale, "endpoint.signup")}
        </a>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <div className="min-w-0">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--color-muted-foreground)]">
              WSS
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="min-h-8 px-2 text-[11px]"
              onClick={() => onCopy("wss", wss)}
            >
              {copied === "wss" ? t(locale, "endpoint.copied") : t(locale, "common.copy")}
            </Button>
          </div>
          <code className="block truncate rounded-[2px] border border-[var(--color-line)] bg-[#07070E] px-2 py-1.5 font-mono text-[11px] text-[#D0D5E8]">
            {wss}
          </code>
        </div>
        <div className="min-w-0">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--color-muted-foreground)]">
              HTTPS
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="min-h-8 px-2 text-[11px]"
              onClick={() => onCopy("https", https)}
            >
              {copied === "https" ? t(locale, "endpoint.copied") : t(locale, "common.copy")}
            </Button>
          </div>
          <code className="block truncate rounded-[2px] border border-[var(--color-line)] bg-[#07070E] px-2 py-1.5 font-mono text-[11px] text-[#D0D5E8]">
            {https}
          </code>
        </div>
      </div>
      <p className="mt-2 text-[11px] leading-snug text-[var(--color-muted-foreground)]">
        {t(locale, "endpoint.hint")}
      </p>
    </div>
  );
}
