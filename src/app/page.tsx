import Link from "next/link";
import { Brand } from "@/components/Brand";

export default function Home() {
  return (
    <main className="phone px-5 py-8">
      <Brand />
      <h1 className="mt-6 text-3xl font-bold">More time coaching.<br /><span className="text-brand">Less time scheduling.</span></h1>
      <p className="mt-3 text-muted">One link. They pick a slot. You show up to teach.</p>
      <div className="mt-8 space-y-3">
        <Link href="/app/register" className="block rounded-2xl bg-brand py-3 text-center font-semibold text-white">Open for business</Link>
        <Link href="/tim-zhang" className="block rounded-2xl border border-line py-3 text-center font-semibold">See a live page</Link>
      </div>
    </main>
  );
}
