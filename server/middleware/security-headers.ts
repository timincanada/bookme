/**
 * Security response headers for every response (Nitro global middleware).
 * No Content-Security-Policy yet: the platform (Grok) script injection is still
 * in place and would be blocked; add CSP after the Grok cleanup batch.
 */
type HeaderEvent = { res: { headers: Headers } };

export default async function securityHeaders(event: HeaderEvent, next: () => unknown | Promise<unknown>) {
  const h = event.res.headers;
  h.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  h.set("X-Content-Type-Options", "nosniff");
  h.set("X-Frame-Options", "SAMEORIGIN");
  h.set("Referrer-Policy", "strict-origin-when-cross-origin");
  h.set("Permissions-Policy", "camera=(), geolocation=(), payment=(self \"https://checkout.stripe.com\"), microphone=(self)");
  h.set("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  return next();
}
