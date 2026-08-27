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
    if (data.admin) {
      router.push("/app/admin");
      return;
    }
    router.push(data.setup ? "/app/schedule" : "/app/setup");
  }

  return (
    <main className="phone px-5 pb-8">
      <Brand />
      <h1 className="text-2xl font-bold">Coach sign in</h1>
      <label className="mt-5 block text-sm">Email</label>
      <input value={email} onChange={(e) => setEmail(e.target.value)} className="field mt-1" />
      <label className="mt-3 block text-sm">Password</label>
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="field mt-1" />
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      <button disabled={busy || !email || !password} onClick={submit} className="mt-6 w-full rounded-2xl bg-brand py-3 font-semibold text-white disabled:opacity-40">
        Sign in
      </button>
      <p className="mt-4 text-center text-sm text-muted">
        New coach? <Link href="/app/register" className="font-semibold text-brand">Open for business</Link>
      </p>
    </main>
  );
}
