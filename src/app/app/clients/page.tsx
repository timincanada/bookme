import Link from "next/link";
import { Brand } from "@/components/Brand";
import { TabBar } from "@/components/TabBar";

export default function ClientsPlaceholder() {
  return (
    <main className="phone px-5 pb-24">
      <Brand />
      <h1 className="text-2xl font-bold">Clients</h1>
      <p className="mt-2 text-slate-500">Client list, history, and notes ship next.</p>
      <Link href="/app/schedule" className="mt-6 block font-semibold text-[#10B981]">Back to schedule</Link>
      <TabBar active="clients" />
    </main>
  );
}
