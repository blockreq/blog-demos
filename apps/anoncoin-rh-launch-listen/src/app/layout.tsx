import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Anoncoin · RH anon launch listen | BlockReq demo",
  description:
    "Beginner-friendly Robinhood Chain demo: eth_subscribe PairCreated → new launch cards via BlockReq public WSS.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
