/** Public web origin (browser-safe). */
export function publicSiteUrl() {
  if (typeof window !== "undefined" && /(^|\.)bookme\.training$/.test(window.location.hostname)) {
    return window.location.origin;
  }
  return "https://bookme.training";
}
