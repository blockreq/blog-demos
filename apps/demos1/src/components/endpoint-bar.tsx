import { useState } from "react";
import type { Locale } from "@blockreq/i18n";
import { t } from "@blockreq/i18n";
import { Badge, Button, Input, cn } from "@blockreq/ui";

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

/**
 * Editable HTTPS + WSS endpoints (defaults from PUBLIC_ENDPOINTS).
 * Parent owns persistence via useEditableEndpoints; Apply commits draft.
 */
export function EndpointBar({
  locale,
  wss,
  https,
  chainLabel,
  className,
  editable = true,
  draftWss,
  draftHttps,
  dirty,
  onDraftWss,
  onDraftHttps,
  onApply,
  onReset,
}: {
  locale: Locale;
  wss: string;
  https: string;
  chainLabel: string;
  className?: string;
  editable?: boolean;
  draftWss?: string;
  draftHttps?: string;
  dirty?: boolean;
  onDraftWss?: (v: string) => void;
  onDraftHttps?: (v: string) => void;
  onApply?: () => void;
  onReset?: () => void;
}) {
  const [copied, setCopied] = useState<"wss" | "https" | null>(null);
  const showWss = editable && draftWss !== undefined ? draftWss : wss;
  const showHttps = editable && draftHttps !== undefined ? draftHttps : https;

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
          {t(locale, "shell.quotaAfter")}
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
              onClick={() => onCopy("wss", showWss)}
            >
              {copied === "wss" ? t(locale, "endpoint.copied") : t(locale, "common.copy")}
            </Button>
          </div>
          {editable && onDraftWss ? (
            <Input
              value={showWss}
              onChange={(e) => onDraftWss(e.target.value)}
              spellCheck={false}
              className="h-9 font-mono text-[11px]"
              title={showWss}
              aria-label="WSS endpoint"
            />
          ) : (
            <code className="addr block truncate rounded-[2px] border border-[var(--color-line)] bg-[#07070E] px-2 py-1.5 font-mono text-[11px] text-[#D0D5E8]" title={wss}>
              {wss}
            </code>
          )}
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
              onClick={() => onCopy("https", showHttps)}
            >
              {copied === "https" ? t(locale, "endpoint.copied") : t(locale, "common.copy")}
            </Button>
          </div>
          {editable && onDraftHttps ? (
            <Input
              value={showHttps}
              onChange={(e) => onDraftHttps(e.target.value)}
              spellCheck={false}
              className="h-9 font-mono text-[11px]"
              title={showHttps}
              aria-label="HTTPS endpoint"
            />
          ) : (
            <code className="addr block truncate rounded-[2px] border border-[var(--color-line)] bg-[#07070E] px-2 py-1.5 font-mono text-[11px] text-[#D0D5E8]" title={https}>
              {https}
            </code>
          )}
        </div>
      </div>
      {editable ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-h-8 px-3 text-[11px]"
            disabled={!dirty}
            onClick={() => onApply?.()}
          >
            {t(locale, "endpoint.apply")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-h-8 px-3 text-[11px]"
            onClick={() => onReset?.()}
          >
            {t(locale, "endpoint.reset")}
          </Button>
          <span className="font-mono text-[10px] text-[var(--color-muted-foreground)]">
            {t(locale, "endpoint.editHint")}
          </span>
        </div>
      ) : null}
      <p className="mt-2 text-[11px] leading-snug text-[var(--color-muted-foreground)]">
        {t(locale, "endpoint.hint")}
      </p>
    </div>
  );
}
