"use client";

const SIGNUP =
  process.env.NEXT_PUBLIC_SIGNUP_URL || "https://blockreq.com/pricing";
const BLOG =
  process.env.NEXT_PUBLIC_BLOG_URL ||
  "https://blockreq.com/blog/en/openlaunch-base-eth-subscribe";

export function DemoCta({ title }: { title: string }) {
  return (
    <footer className="fixed inset-x-0 bottom-0 z-40 border-t-2 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-slate-900">{title}</p>
          <p className="text-sm text-slate-500">
            Free public WSS demo · upgrade on BlockReq for higher limits &amp; private keys
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <a
            href={BLOG}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 items-center justify-center rounded-xl border-2 border-slate-200 bg-white px-5 text-base font-bold text-slate-800 hover:bg-slate-50"
          >
            Read the guide
          </a>
          <a
            href={SIGNUP}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 items-center justify-center rounded-xl bg-blue-600 px-6 text-base font-bold text-white hover:bg-blue-700"
          >
            Sign up / Pricing →
          </a>
        </div>
      </div>
    </footer>
  );
}
