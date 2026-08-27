import Link from "next/link";
import { notFound } from "next/navigation";
import { Brand } from "@/components/Brand";
import { VisitBeacon } from "@/components/VisitBeacon";
import { prisma } from "@/lib/db";
import { canCopyBookingLink, isSetupComplete } from "@/lib/setup";

export const dynamic = "force-dynamic";

export default async function CoachPage({ params }: { params: { slug: string } }) {
  const coach = await prisma.coach.findUnique({
    where: { slug: params.slug },
    include: { services: true, locations: { where: { active: true } }, hours: true },
  });
  if (!coach) notFound();
  const service = coach.services[0];
  const setup = isSetupComplete({
    title: coach.title,
    timezone: coach.timezone,
    service: service || null,
    locationCount: coach.locations.length,
    hourCount: coach.hours.length,
  });
  const open = canCopyBookingLink(setup, coach.subscriptionStatus, coach.trialEndsAt, {
    banned: coach.banned,
    accessGrant: coach.accessGrant,
  });
  return (
    <main className="phone px-5 pb-8">
      <VisitBeacon />
      <Brand />
      <div className="flex flex-col items-center text-center">
        <div className="flex h-28 w-28 items-center justify-center rounded-full bg-brand-soft text-4xl font-semibold text-brand-dark">
          {coach.name.slice(0, 1)}
        </div>
        <h1 className="mt-4 text-2xl font-bold text-ink">{coach.name}</h1>
        <p className="text-muted">{coach.title} · {coach.city}</p>
      </div>
      <ul className="mt-8 divide-y divide-line text-left">
        <li className="py-3">{service?.name} · All levels</li>
        <li className="py-3">{service?.duration} min</li>
        <li className="py-3">{coach.languages}</li>
      </ul>
      <h2 className="mt-6 font-semibold">Teaching locations</h2>
      <ul className="mt-2 divide-y divide-line">
        {coach.locations.map((l) => (
          <li key={l.id} className="py-3">{l.name}</li>
        ))}
      </ul>
      {open ? (
        <Link href={`/book?coach=${coach.slug}`} className="mt-8 block rounded-2xl bg-brand py-3 text-center font-semibold text-white">Book a lesson</Link>
      ) : (
        <p className="mt-8 text-center text-sm text-muted">This coach is not taking new bookings right now.</p>
      )}
    </main>
  );
}
