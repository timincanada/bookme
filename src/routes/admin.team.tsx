import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Chip } from "@/components/bookme/admin-ui";
import { Button } from "@/components/ui/button";
import { adminTeam, adminUpdateTeam } from "@/lib/bookme/admin-api";

export const Route = createFileRoute("/admin/team")({ component: Team });

type Data = Extract<Awaited<ReturnType<typeof adminTeam>>, { ok: true }>;

function Team() {
  const [data, setData] = useState<Data | null>(null);
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  function load() {
    return adminTeam().then((r) => (r.ok ? setData(r) : setMsg(r.error)));
  }
  useEffect(() => {
    void load();
  }, []);

  async function update(action: "add" | "remove", value: string) {
    setBusy(true);
    const res = await adminUpdateTeam({ data: { action, email: value } });
    setBusy(false);
    setMsg(res.ok ? res.message : res.error);
    if (res.ok) {
      setEmail("");
      void load();
    }
  }

  if (!data) return <p className="text-muted">{msg || "Loading…"}</p>;

  return (
    <>
      <h1 className="font-display text-3xl font-medium">Team</h1>
      <p className="mt-1 max-w-xl text-sm text-muted">
        Admins can view everything here, extend trials and look up a student. Access grants, bans and team changes are
        owner-only. Each person signs in with their own BookMe account and must confirm their email.
      </p>

      <ul className="mt-5 space-y-2">
        {data.team.map((m) => (
          <li key={m.email} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-card p-4 text-sm ring-1 ring-line">
            <span>
              <span className="font-semibold">{m.email}</span>
              <span className="block text-xs text-muted">
                added {m.createdAt.slice(0, 10)}
                {m.addedBy ? ` by ${m.addedBy}` : ""}
              </span>
            </span>
            <span className="flex items-center gap-2">
              <Chip tone={m.role === "owner" ? "good" : "muted"}>{m.role}</Chip>
              {m.role === "owner" ? null : (
                <Button size="sm" variant="outline" className="text-coral" disabled={busy} onClick={() => void update("remove", m.email)}>
                  Remove
                </Button>
              )}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-5 grid gap-2 sm:grid-cols-[1fr_auto]">
        <input className="field" type="email" placeholder="teammate@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Button size="field" disabled={busy || !email.trim()} onClick={() => void update("add", email)}>
          Add admin
        </Button>
      </div>
      {msg ? <p className="mt-3 text-sm text-forest">{msg}</p> : null}

      <h2 className="mt-8 font-display text-2xl">Recent admin activity</h2>
      <ul className="mt-3 space-y-2">
        {data.actions.map((a) => (
          <li key={a.id} className="rounded-2xl bg-card p-3 text-sm ring-1 ring-line">
            <p className="font-semibold">
              {a.kind} <span className="font-normal text-muted">· {a.subjectType} {a.subjectId}</span>
            </p>
            <p className="text-xs text-muted">
              {a.actor} ({a.role}) · {new Date(a.at).toLocaleString("en-CA")} {a.detail ? `· ${a.detail}` : ""} {a.note ? `· ${a.note}` : ""}
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}
