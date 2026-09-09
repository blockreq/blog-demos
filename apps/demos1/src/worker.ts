/**
 * Static-assets Worker for demos1.
 * Serves built Vite assets and sets embed CSP. Does NOT proxy RPC / WSS.
 */

export interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
}

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

    if (url.pathname === "/demos1") {
      url.pathname = "/demos1/";
      return Response.redirect(url.toString(), 308);
    }

    const assetRes = await env.ASSETS.fetch(request);
    return withSecurityHeaders(assetRes);
  },
};
