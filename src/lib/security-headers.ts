/**
 * Security headers for every response.
 *
 * Two places apply them, and they must agree (security-headers.test.ts checks):
 *  - src/server.ts, for pages and server functions the Worker renders;
 *  - public/_headers, for static files Cloudflare serves without running the
 *    Worker (the offline shell at "/", /assets/*, sw.js, icons, assetlinks).
 *
 * CSP notes:
 *  - script-src needs 'unsafe-inline': TanStack Start inlines the hydration
 *    data as <script> tags. Move to nonces when Start supports them here.
 *  - Gemini is called only from the Worker, so it is NOT in connect-src.
 *  - img-src allows any https image: imported recipes keep the platform's
 *    thumbnail (TikTok/IG/YouTube CDNs change hostnames often).
 *  - To debug a breakage in production without turning protection off,
 *    rename the header to Content-Security-Policy-Report-Only for a day.
 */
export const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://fonts.googleapis.com https://fonts.gstatic.com",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

export const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": CSP,
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(self), microphone=(), geolocation=(), payment=(), usb=()",
  "Strict-Transport-Security": "max-age=31536000",
};

/** Adds the headers a response does not already set. Returns a new Response (Worker responses can be immutable). */
export function withSecurityHeaders(response: Response): Response {
  const out = new Response(response.body, response);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    if (!out.headers.has(name)) out.headers.set(name, value);
  }
  return out;
}
