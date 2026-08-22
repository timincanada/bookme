import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Brand } from "@/components/Brand";
import { TabBar } from "@/components/TabBar";
import { currentCoach } from "@/lib/session";
import { prisma } from "@/lib/db";
import { formatWhen } from "@/lib/time";
import { ClientNote } from "@/components/ClientNote";

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  const coach = await currentCoach();
  if (!coach) redirect("/app/login");
  const client = await prisma.client.findUnique({ where: { id: params.id } });
  if (!client) notFound();
  const lessons = await prisma.lesson.findMany({
    where: { coachId: coach.id, clientId: client.id },
    include: { location: true, payment: true },
    orderBy: { startAt: "desc" },
  });
  if (lessons.length === 0) notFound();
  return (
    <main className="phone px-5 pb-24">
      <Brand />
      <Link href="/app/clients" className="text-sm font-semibold text-brand">Clients</Link>
      <h1 className="mt-2 text-2xl font-bold">{client.name}</h1>
      <p className="text-muted">{client.email}</p>
      <h2 className="mt-6 font-semibold">Note</h2>
      <ClientNote clientId={client.id} note={client.note} />
      <h2 className="mt-6 font-semibold">Lesson history</h2>
      <ul className="mt-2 space-y-3">
        {lessons.map((l) => (
          <li key={l.id} className="card">
            <div className="font-semibold">{formatWhen(l.startAt)}</div>
            <div className="text-sm text-muted">{l.location.name} · {l.status}</div>
          </li>
        ))}
      </ul>
      <TabBar active="clients" />
    </main>
  );
}
