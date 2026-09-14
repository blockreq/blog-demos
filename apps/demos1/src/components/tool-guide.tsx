import { ToolBlurb } from "./tool-blurb";

/**
 * @deprecated ToolGuideBanner (BlockReq public / 浏览器直连 strip) removed.
 * Prefer ToolBlurb with each demo's *.guide practical copy.
 */
export function ToolGuideBanner({
  stepHint,
  className,
}: {
  locale?: unknown;
  stepHint: string;
  className?: string;
}) {
  return <ToolBlurb text={stepHint} className={className} />;
}
