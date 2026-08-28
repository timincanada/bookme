"use client";

import { useState } from "react";

export function StaffSignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not sign in");
      return;
    }
    window.location.reload();
  }

  return (
    <>
      <h1 className="text-2xl font-bold">Staff sign in</h1>
      <label className="mt-5 block text-sm">Email</label>
      <input value={email} onChange={(e) => setEmail(e.target.value)} className="field mt-1" autoComplete="username" />
      <label className="mt-3 block text-sm">Password</label>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="field mt-1"
        autoComplete="current-password"
      />
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      <button
        disabled={busy || !email || !password}
        onClick={submit}
        className="mt-6 w-full rounded-2xl bg-brand py-3 font-semibold text-white disabled:opacity-40"
      >
        Sign in
      </button>
    </>
  );
}
