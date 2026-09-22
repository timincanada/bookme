/**
 * Content-Security-Policy with a per-request nonce (production only).
 *
 * The router is created once per server request; on the server we mint a nonce,
 * send the CSP header for this response, and hand the nonce to the router so
 * every inline/SSR script it renders carries it. No 'unsafe-inline' for scripts.
 * Vite dev injects un-nonced inline scripts, so dev gets no CSP.
 */
import { createIsomorphicFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";

export function buildCsp(nonce: string) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    "media-src 'self' data: blob:",
    // Voice assistant streams to xAI realtime from the browser.
    "connect-src 'self' wss://api.x.ai",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "frame-src 'self'",
    "frame-ancestors 'self'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

/** Returns this request's nonce on the server (and sets the CSP header); undefined in the browser or in dev. */
export const cspNonceForRequest = createIsomorphicFn()
  .server(() => {
    if (process.env.NODE_ENV !== "production") return undefined;
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    const nonce = btoa(String.fromCharCode(...bytes));
    try {
      // CSP_REPORT_ONLY=1: browsers only log violations (use for the first deploy).
      const header = process.env.CSP_REPORT_ONLY === "1" ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy";
      setResponseHeader(header, buildCsp(nonce));
    } catch {
      return undefined; // no request context (e.g. build-time) → no nonce, no header
    }
    return nonce;
  })
  .client(() => undefined);
