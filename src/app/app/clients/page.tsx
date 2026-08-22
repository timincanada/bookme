import { redirect } from "next/navigation";
import Link from "next/link";
import { Brand } from "@/components/Brand";
import { TabBar } from "@/components/TabBar";
import { currentCoach } from "@/lib/session";
import { prisma } from "@/lib/db";

export default async function ClientsPage() {
  const coach = await currentCoach();
  if (!coach) redirect("/app/login");
  const lessons = await prisma.lesson.findMany({
    where: { coachId: coach.id },
    include: { client: true },
    orderBy: { startAt: "desc" },
  });
  const byId = new Map<string, { id: string; name: string; email: string; count: number; lastAt: Date }>();
  for (const l of lessons) {
    const existing = byId.get(l.clientId);
    if (existing) {
      existing.count += 1;
    } else {
      byId.set(l.clientId, {
        id: l.client.id,
        name: l.client.name,
        email: l.client.email,
        count: 1,
        lastAt: l.startAt,
      });
    }
  }
  const clients = [...byId.values()];
  return (
    <main className="phone px-5 pb-24">
      <Brand />
      <h1 className="text-2xl font-bold">Clients</h1>
      <p className="text-slate-500">{clients.length} people who booked with you</p>
      <ul className="mt-5 space-y-3">
        {clients.map((c) => (
          <li key={c.id}>
            <Link href={`/app/clients/${c.id}`} className="block rounded-xl border border-slate-200 p-4">
              <div className="font-semibold">{c.name}</div>
              <div className="text-sm text-slate-500">{c.email}</div>
              <div className="mt-1 text-xs text-slate-500">{c.count} lesson{c.count === 1 ? "" : "s"}</div>
            </Link>
          </li>
        ))}
        {clients.length === 0 && <p className="text-slate-500">No clients yet. First booking creates the record.</p>}
      </ul>
      <TabBar active="clients" />
    </main>
  );
}
