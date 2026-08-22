import Link from "next/link";
import { Brand } from "@/components/Brand";

export default function Home() {
  return (
    <main className="phone px-5 py-8">
      <Brand />
      <h1 className="mt-6 text-3xl font-bold">More time coaching.<br /><span className="text-[#10B981]">Less time scheduling.</span></h1>
      <p className="mt-3 text-slate-500">Book and pay private lessons — or pay cash at the court.</p>
      <div className="mt-8 space-y-3">
        <Link href="/tim-zhang" className="block rounded-xl bg-[#10B981] py-3 text-center font-semibold text-white">Book Tim Zhang</Link>
        <Link href="/app/register" className="block rounded-xl border border-slate-200 py-3 text-center font-semibold">Open for business</Link>
        <Link href="/app/login" className="block rounded-xl border border-slate-200 py-3 text-center font-semibold">Coach sign in</Link>
        <Link href="/manage" className="block rounded-xl border border-slate-200 py-3 text-center font-semibold">Find a booking by email</Link>
      </div>
    </main>
  );
}
