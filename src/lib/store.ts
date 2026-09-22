import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useEffect, useState } from "react";
import { HST, SEED_COACHES, type Coach, type Sport } from "./coaches";
import { slugify } from "./utils";

export type Session = {
  name: string;
  email: string;
  slug: string;
  demo?: boolean;
};

export type Draft = {
  slug: string;
  lessonId: string;
  locationId: string;
  date: string;
  time: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
};

export type Booking = {
  id: string;
  slug: string;
  coachName: string;
  lessonName: string;
  locationName: string;
  date: string;
  time: string;
  durationMin: number;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  subtotal: number;
  tax: number;
  total: number;
  currency: "CAD";
  createdAt: string;
};

type State = {
  hydrated: boolean;
  session: Session | null;
  extraCoaches: Coach[];
  bookings: Booking[];
  draft: Draft | null;
  setHydrated: () => void;
  setDraft: (draft: Draft | null) => void;
  patchDraft: (patch: Partial<Draft>) => void;
  signIn: (session: Session) => void;
  signOut: () => void;
  addCoach: (coach: Coach) => void;
  addBooking: (booking: Booking) => void;
};

export const useBookMe = create<State>()(
  persist(
    (set, get) => ({
      hydrated: false,
      session: null,
      extraCoaches: [],
      bookings: [],
      draft: null,
      setHydrated: () => set({ hydrated: true }),
      setDraft: (draft) => set({ draft }),
      patchDraft: (patch) => {
        const current = get().draft;
        if (!current) return;
        set({ draft: { ...current, ...patch } });
      },
      signIn: (session) => set({ session }),
      signOut: () => set({ session: null }),
      addCoach: (coach) =>
        set({ extraCoaches: [...get().extraCoaches.filter((c) => c.slug !== coach.slug), coach] }),
      addBooking: (booking) => set({ bookings: [booking, ...get().bookings] }),
    }),
    {
      name: "bookme.training.v1",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({
        session: s.session,
        extraCoaches: s.extraCoaches,
        bookings: s.bookings,
        draft: s.draft,
      }),
    },
  ),
);

export function useHydrateBookMe() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void Promise.resolve(useBookMe.persist.rehydrate()).then(() => {
      useBookMe.getState().setHydrated();
      setReady(true);
    });
  }, []);
  return ready;
}

export function allCoaches(): Coach[] {
  const extra = useBookMe.getState().extraCoaches;
  const extraSlugs = new Set(extra.map((c) => c.slug));
  return [...extra, ...SEED_COACHES.filter((c) => !extraSlugs.has(c.slug))];
}

export function uniqueSlug(name: string): string {
  const base = slugify(name) || "coach";
  const taken = new Set(allCoaches().map((c) => c.slug));
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`)) i += 1;
  return `${base}-${i}`;
}

export function quoteFor(coach: Coach, lessonId: string) {
  const lesson = coach.lessons.find((l) => l.id === lessonId) ?? coach.lessons[0];
  const subtotal = lesson?.price ?? 0;
  const tax = Math.round(subtotal * HST * 100) / 100;
  const total = Math.round((subtotal + tax) * 100) / 100;
  return { lesson, subtotal, tax, total };
}

export function bookingsFor(slug: string): Booking[] {
  return useBookMe.getState().bookings.filter((b) => b.slug === slug);
}

export function sportFromString(value: string): Sport {
  return (value as Sport) || "tennis";
}
