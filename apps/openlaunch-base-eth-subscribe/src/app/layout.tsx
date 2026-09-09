import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpenLaunch · Base one-tx launch listen | BlockReq demo",
  description:
    "Beginner-friendly Base demo: eth_subscribe Uniswap v4 Initialize + lock → one-tx launch cards via BlockReq public WSS.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
