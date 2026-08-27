export function publicAppUrl() {
  const raw = process.env.NEXT_PUBLIC_APP_URL || "https://bookme.training";
  return raw.replace(/\/$/, "");
}
