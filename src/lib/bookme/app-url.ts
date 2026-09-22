export function publicAppUrl() {
  const raw =
    process.env.BOOKME_APP_URL ||
    process.env.VITE_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "https://bookme.training";
  return raw.replace(/\/$/, "");
}
