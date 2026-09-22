import { SEED_COACHES, findCoach } from "./coaches";
import { useBookMe, type Booking } from "./store";
import { addDays, isoDate } from "./utils";

export function useWorkspace() {
  const session = useBookMe((s) => s.session);
  const extra = useBookMe((s) => s.extraCoaches);
  const bookings = useBookMe((s) => s.bookings);
  const coach =
    (session ? findCoach(session.slug, extra) : undefined) ??
    SEED_COACHES[0];
  const mine = bookings.filter((b) => b.slug === coach.slug);
  const seeded = session?.demo || coach.slug === "daniel-kim" ? demoBookings(coach.slug, coach.name) : [];
  const all = dedupe([...mine, ...seeded]);
  return { session, coach, bookings: all };
}

function demoBookings(slug: string, coachName: string): Booking[] {
  const today = isoDate(new Date());
  const tomorrow = isoDate(addDays(new Date(), 1));
  return [
    {
      id: "demo-1",
      slug,
      coachName,
      lessonName: "Private Tennis Lesson",
      locationName: "Mayfair Parkway",
      date: today,
      time: "4:30 PM",
      durationMin: 60,
      clientName: "Alex Morgan",
      clientEmail: "alex.morgan@email.com",
      clientPhone: "(647) 555-0148",
      subtotal: 85,
      tax: 11.05,
      total: 96.05,
      currency: "CAD",
      createdAt: new Date().toISOString(),
    },
    {
      id: "demo-2",
      slug,
      coachName,
      lessonName: "Adult Tennis",
      locationName: "Mayfair Parkway",
      date: today,
      time: "8:00 AM",
      durationMin: 60,
      clientName: "Noah Patel",
      clientEmail: "noah@email.com",
      clientPhone: "",
      subtotal: 45,
      tax: 5.85,
      total: 50.85,
      currency: "CAD",
      createdAt: new Date().toISOString(),
    },
    {
      id: "demo-3",
      slug,
      coachName,
      lessonName: "Junior Academy",
      locationName: "Mayfair Parkway",
      date: tomorrow,
      time: "10:00 AM",
      durationMin: 60,
      clientName: "Sam Chen",
      clientEmail: "sam@email.com",
      clientPhone: "",
      subtotal: 45,
      tax: 5.85,
      total: 50.85,
      currency: "CAD",
      createdAt: new Date().toISOString(),
    },
  ];
}

function dedupe(list: Booking[]): Booking[] {
  const seen = new Set<string>();
  return list.filter((b) => {
    const key = `${b.date}|${b.time}|${b.clientEmail}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
