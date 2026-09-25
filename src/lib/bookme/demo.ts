export const DEMO_COACH = {
  name: "Alex Rivera",
  email: "coach@bookme.test",
  password: "BookMe-demo-1",
  verticalId: "tennis" as const,
  slug: "alex",
  photoUrl: "/photos/jordan-k.jpg",
  headline: "Private tennis for every level — technique, match play, and confidence.",
  bio: "Patient, structured lessons for juniors and adults.",
  title: "Tennis Coach",
  /** 60-minute rate. 30 minutes is cheaper; see DEMO_DURATION_PRICES. */
  priceCad: 85,
};

/** Demo coach offers two lengths. price_cad stored on the row is the 30-minute rate. */
export const DEMO_DURATION_PRICES: Record<string, number> = {
  "30": 55,
  "60": 85,
};

/** Mayfair Clubs, 50 Steelcase Rd E, Markham — in-person demo venue. */
export const DEMO_VENUE = {
  name: "Mayfair Parkway",
  address: "50 Steelcase Rd, Markham",
  lat: 43.8365,
  lng: -79.348,
};

/**
 * Demo seed stays off on production (`VERCEL_ENV=production`).
 * Local dev, `BOOKME_ALLOW_DEMO=1`, and Vercel Preview may seed.
 */
export function demoAllowed(
  env: { NODE_ENV?: string; BOOKME_ALLOW_DEMO?: string; VERCEL_ENV?: string } = process.env,
) {
  return env.NODE_ENV !== "production" || env.BOOKME_ALLOW_DEMO === "1" || env.VERCEL_ENV?.toLowerCase() === "preview";
}

export const DEMO_STUDENTS = [
  { name: "Emma Chen", email: "emma@bookme.test" },
  { name: "Jordan Lee", email: "jordan@bookme.test" },
  { name: "Sam Patel", email: "sam@bookme.test" },
] as const;
