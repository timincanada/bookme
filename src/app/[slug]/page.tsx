import Link from "next/link";
import { notFound } from "next/navigation";
import { Brand } from "@/components/Brand";
import { prisma } from "@/lib/db";

export default async function CoachPage({ params }: { params: { slug: string } }) {
  const coach = await prisma.coach.findUnique({
    where: { slug: params.slug },
    include: { services: true, locations: { where: { active: true } } },
  });
  if (!coach) notFound();
  const service = coach.services[0];
  return (
    <main className="phone px-5 pb-8">
      <Brand />
      <div className="flex flex-col items-center text-center">
        <div className="h-28 w-28 rounded-full bg-emerald-100" />
        <h1 className="mt-4 text-2xl font-bold">{coach.name}</h1>
        <p className="text-slate-500">{coach.title} · {coach.city}</p>
      </div>
      <ul className="mt-8 divide-y divide-slate-100 text-left">
        <li className="py-3">{service?.name} · All levels</li>
        <li className="py-3">{service?.duration} min · CA${service?.priceCad}</li>
        <li className="py-3">{coach.languages}</li>
      </ul>
      <h2 className="mt-6 font-semibold">Teaching locations</h2>
      <ul className="mt-2 divide-y divide-slate-100">
        {coach.locations.map((l) => (
          <li key={l.id} className="py-3">{l.name}</li>
        ))}
      </ul>
      <Link href={`/book?coach=${coach.slug}`} className="mt-8 block rounded-xl bg-[#10B981] py-3 text-center font-semibold text-white">Book a lesson</Link>
    </main>
  );
}
