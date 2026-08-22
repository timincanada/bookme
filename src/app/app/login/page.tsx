"use client";
import { Brand } from "@/components/Brand";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not sign in");
      return;
    }
    router.push(data.setup ? "/app/schedule" : "/app/setup");
  }

  return (
    <main className="phone px-5 pb-8">
      <Brand />
      <h1 className="text-2xl font-bold">Coach sign in</h1>
      <label className="mt-5 block text-sm">Email</label>
      <input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" />
      <label className="mt-3 block text-sm">Password</label>
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" />
      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
      <button disabled={busy || !email || !password} onClick={submit} className="mt-6 w-full rounded-xl bg-[#10B981] py-3 font-semibold text-white disabled:opacity-40">
        Sign in
      </button>
      <p className="mt-4 text-center text-sm text-slate-500">
        New coach? <Link href="/app/register" className="font-semibold text-[#10B981]">Open for business</Link>
      </p>
    </main>
  );
}
