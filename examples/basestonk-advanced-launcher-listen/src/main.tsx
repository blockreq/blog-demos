import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Locale } from "@blockreq/i18n";
import { BasestonkAdvancedLauncherListenDemo } from "@demos1/demos/basestonk-advanced-launcher-listen";
import "@blockreq/ui/globals.css";

/**
 * Thin StackBlitz / Vite shell — mounts the demos1 listen UI (React + viem + @blockreq/ui).
 * Shared logic lives in apps/demos1/src/demos/basestonk-advanced-launcher-listen.tsx (no vanilla HTML twin).
 */
function App() {
  const [locale, setLocale] = useState<Locale>("en");
  return <BasestonkAdvancedLauncherListenDemo locale={locale} onLocaleChange={setLocale} />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
