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
  accessGrant: string;
  grantLabel: string;
};

type Stats = {
  registeredCoaches: number;
  publicUniqueVisitors: number;
  onTrial: number;
  subscribed: number;
  conversionLabel: string;
};

export function AdminList() {
  const [subscribed, setSubscribed] = useState(false);
  const [coaches, setCoaches] = useState<CoachRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (nextSubscribed: boolean) => {
    setError("");
    const res = await fetch(`/api/admin/coaches${nextSubscribed ? "?paid=1" : ""}`);
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
    setStats(data.stats || null);
  }, []);

  useEffect(() => {
    load(subscribed);
  }, [subscribed, load]);

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
    await load(subscribed);
  }

  async function setGrant(id: string, grant: "paid" | "unpaid" | "") {
    setBusyId(id);
    setError("");
    const res = await fetch(`/api/admin/coaches/${id}/access`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grant }),
    });
    const data = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!res.ok) {
      setError(data.error || "Could not update access");
      return;
    }
    await load(subscribed);
  }

  return (
    <>
      {stats && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="card text-sm">
            <div className="text-muted">Views</div>
            <div className="mt-1 font-semibold">Registered coaches: {stats.registeredCoaches}</div>
            <div className="font-semibold">Public unique visitors: {stats.publicUniqueVisitors}</div>
          </div>
          <div className="card text-sm">
            <div className="text-muted">On trial</div>
            <div className="mt-1 text-xl font-bold">{stats.onTrial}</div>
          </div>
          <div className="card text-sm">
            <div className="text-muted">Subscribed</div>
            <div className="mt-1 text-xl font-bold">{stats.subscribed}</div>
          </div>
          <div className="card text-sm">
            <div className="text-muted">Conversion</div>
            <div className="mt-1 font-semibold">{stats.conversionLabel}</div>
          </div>
        </div>
      )}
      <div className="mt-4 flex gap-2">
        <button type="button" className={`choice ${!subscribed ? "choice-on" : ""}`} onClick={() => setSubscribed(false)}>
          All
        </button>
        <button type="button" className={`choice ${subscribed ? "choice-on" : ""}`} onClick={() => setSubscribed(true)}>
          Subscribed
        </button>
      </div>
      <p className="mt-2 text-sm text-muted">Subscribed = trialing or active.</p>
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
            <div className="text-sm">Billing: {c.feeLabel}</div>
            <div className="text-sm">{c.grantLabel}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busyId === c.id}
                onClick={() => setGrant(c.id, "paid")}
                className="rounded-xl border border-line px-3 py-2 text-sm font-semibold disabled:opacity-40"
              >
                Mark paid
              </button>
              <button
                type="button"
                disabled={busyId === c.id}
                onClick={() => setGrant(c.id, "unpaid")}
                className="rounded-xl border border-line px-3 py-2 text-sm font-semibold disabled:opacity-40"
              >
                Mark unpaid
              </button>
              {c.accessGrant ? (
                <button
                  type="button"
                  disabled={busyId === c.id}
                  onClick={() => setGrant(c.id, "")}
                  className="rounded-xl border border-line px-3 py-2 text-sm font-semibold disabled:opacity-40"
                >
                  Clear grant
                </button>
              ) : null}
            </div>
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
