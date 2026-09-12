import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Locale } from "@blockreq/i18n";
import { BaseLaptopSniperLiquidityDemo } from "@demos1/demos/base-laptop-sniper-liquidity-listen";
import "@blockreq/ui/globals.css";

/**
 * Thin StackBlitz / Vite shell — mounts the demos1 listen UI (React + viem + @blockreq/ui).
 * Shared logic lives in apps/demos1/src/demos/base-laptop-sniper-liquidity-listen.tsx (no vanilla HTML twin).
 */
function App() {
  const [locale, setLocale] = useState<Locale>("en");
  return <BaseLaptopSniperLiquidityDemo locale={locale} onLocaleChange={setLocale} />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
