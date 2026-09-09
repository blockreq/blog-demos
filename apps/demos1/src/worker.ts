/**
 * Static-assets Worker for demos1.
 * Serves built Vite assets and sets embed CSP. Does NOT proxy RPC / WSS.
 *
 * Vite `base: "/demos1/"` makes HTML reference `/demos1/assets/...`, but
 * `dist/` is flat (`dist/index.html`, `dist/assets/...`). Zone route is
 * `blockreq.com/demos1*`, so we strip the `/demos1` prefix before
 * `ASSETS.fetch` so lookups match build output. SPA not_found_handling
 * then correctly falls back to index for client routes.
 */

export interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
}

const BASE_PREFIX = "/demos1";

const FRAME_ANCESTORS =
  "frame-ancestors 'self' https://blockreq.com https://*.blockreq.com https://blog.blockreq.com https://docs.blockreq.com http://localhost:* http://127.0.0.1:*";

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.blockreq.com wss://*.blockreq.com https://blockreq.com wss://blockreq.com",
  "worker-src 'self' blob:",
  FRAME_ANCESTORS,
].join("; ");

/** Map zone/public path → path inside `dist/` (leading `/` preserved). */
export function stripDemos1Prefix(pathname: string): string {
  if (pathname === BASE_PREFIX || pathname.startsWith(`${BASE_PREFIX}/`)) {
    const rest = pathname.slice(BASE_PREFIX.length);
    return rest.length === 0 ? "/" : rest;
  }
  return pathname;
}

function withSecurityHeaders(res: Response): Response {
  const headers = new Headers(res.headers);
  headers.set("Content-Security-Policy", CSP);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // Do not set X-Frame-Options — CSP frame-ancestors governs embedding.
  headers.delete("X-Frame-Options");
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === BASE_PREFIX) {
      url.pathname = `${BASE_PREFIX}/`;
      return Response.redirect(url.toString(), 308);
    }

    const assetUrl = new URL(request.url);
    assetUrl.pathname = stripDemos1Prefix(url.pathname);
    const assetReq = new Request(assetUrl, request);
    const assetRes = await env.ASSETS.fetch(assetReq);
    return withSecurityHeaders(assetRes);
  },
};
