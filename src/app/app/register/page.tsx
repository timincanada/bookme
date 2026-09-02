"use client";
import { Brand } from "@/components/Brand";
import { OauthButtons } from "@/components/OauthButtons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [city, setCity] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("error");
    if (q) setError(q);
  }, []);

  async function submit() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, city }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not register");
      return;
    }
    router.push("/app/setup");
  }

  return (
    <main className="phone px-5 pb-8">
      <Brand />
      <h1 className="text-2xl font-bold">Open for business</h1>
      <p className="text-muted">Create a coach account, then set your lesson and hours.</p>
      <label className="mt-5 block text-sm">Name</label>
      <input value={name} onChange={(e) => setName(e.target.value)} className="field mt-1" />
      <label className="mt-3 block text-sm">Email</label>
      <input value={email} onChange={(e) => setEmail(e.target.value)} className="field mt-1" />
      <label className="mt-3 block text-sm">Password</label>
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="field mt-1" />
      <label className="mt-3 block text-sm">City</label>
      <input value={city} onChange={(e) => setCity(e.target.value)} className="field mt-1" placeholder="Markham, ON" />
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      <button disabled={busy || !name || !email || !password} onClick={submit} className="mt-6 w-full rounded-2xl bg-brand py-3 font-semibold text-white disabled:opacity-40">
        Create account
      </button>
      <OauthButtons from="register" />
      <p className="mt-4 text-center text-sm text-muted">
        Already coaching? <Link href="/app/login" className="font-semibold text-brand">Sign in</Link>
      </p>
    </main>
  );
}
