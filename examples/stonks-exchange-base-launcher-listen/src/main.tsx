import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Locale } from "@blockreq/i18n";
import { StonksExchangeBaseLauncherListenDemo } from "@demos1/demos/stonks-exchange-base-launcher-listen";
import "@blockreq/ui/globals.css";

/**
 * Thin StackBlitz / Vite shell — mounts the demos1 listen UI (React + viem + @blockreq/ui).
 * Shared logic lives in apps/demos1/src/demos/stonks-exchange-base-launcher-listen.tsx (no vanilla HTML twin).
 */
function App() {
  const [locale, setLocale] = useState<Locale>("en");
  return <StonksExchangeBaseLauncherListenDemo locale={locale} onLocaleChange={setLocale} />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
