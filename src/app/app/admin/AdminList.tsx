"use client";

import { isAdminEmail } from "@/lib/admin";
import { useCallback, useEffect, useState } from "react";

type CoachRow = {
  id: string;
  name: string;
  email: string;
  slug: string;
  planLabel: string;
  statusLabel: string;
  trialEndsLabel: string;
  feeLabel: string;
  banned: boolean;
};

export function AdminList() {
  const [paid, setPaid] = useState(false);
  const [coaches, setCoaches] = useState<CoachRow[]>([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (nextPaid: boolean) => {
    setError("");
    const res = await fetch(`/api/admin/coaches${nextPaid ? "?paid=1" : ""}`);
    if (res.status === 401) {
      window.location.href = "/app/login";
      return;
    }
    if (!res.ok) {
      setError("Not allowed");
      setCoaches([]);
      return;
    }
    const data = await res.json();
    setCoaches(data.coaches || []);
  }, []);

  useEffect(() => {
    load(paid);
  }, [paid, load]);

  async function ban(id: string) {
    if (!window.confirm("Ban this coach? They will not be able to sign in or take new bookings.")) return;
    setBusyId(id);
    setError("");
    const res = await fetch(`/api/admin/coaches/${id}/ban`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!res.ok) {
      setError(data.error || "Could not ban");
      return;
    }
    await load(paid);
  }

  return (
    <>
      <div className="mt-4 flex gap-2">
        <button type="button" className={`choice ${!paid ? "choice-on" : ""}`} onClick={() => setPaid(false)}>
          All
        </button>
        <button type="button" className={`choice ${paid ? "choice-on" : ""}`} onClick={() => setPaid(true)}>
          Paid
        </button>
      </div>
      <p className="mt-2 text-sm text-muted">Paid = trialing or active.</p>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      <ul className="mt-4 space-y-3">
        {coaches.map((c) => (
          <li key={c.id} className="card">
            <div className="font-semibold">{c.name}</div>
            <div className="text-sm text-muted">{c.email}</div>
            <div className="mt-2 text-sm">Slug: {c.slug}</div>
            <div className="text-sm">Plan: {c.planLabel}</div>
            <div className="text-sm">Status: {c.statusLabel}</div>
            <div className="text-sm">Trial end: {c.trialEndsLabel}</div>
            <div className="text-sm">Fee: {c.feeLabel}</div>
            {c.banned ? (
              <span className="mt-3 inline-block rounded-full bg-danger/10 px-3 py-1 text-sm font-semibold text-danger">
                Banned
              </span>
            ) : isAdminEmail(c.email) ? null : (
              <button type="button" disabled={busyId === c.id} onClick={() => ban(c.id)} className="btn-danger mt-3">
                Ban
              </button>
            )}
          </li>
        ))}
        {coaches.length === 0 && !error && <p className="text-muted">No coaches.</p>}
      </ul>
    </>
  );
}
