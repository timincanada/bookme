import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { decideRequest, getRequestByToken } from "@/lib/bookme/api";

export const Route = createFileRoute("/r/$token")({ component: RequestDecide });

function RequestDecide() {
  const { token } = Route.useParams();
  const [data, setData] = useState<Extract<Awaited<ReturnType<typeof getRequestByToken>>, { ok: true }>["request"] | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getRequestByToken({ data: { token } }).then((res) => {
      if (!res.ok) setError(res.error);
      else setData(res.request);
    });
  }, [token]);

  async function decide(decision: "accepted" | "declined") {
    setBusy(true);
    const res = await decideRequest({ data: { token, decision } });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setDone(res.message);
    setData((cur) => (cur ? { ...cur, pending: false, decision, status: res.status } : cur));
  }

  return (
    <main className="min-h-screen bg-paper">
      <header className="mx-auto flex max-w-2xl items-center px-5 py-5 sm:px-8">
        <Logo />
      </header>
      <div className="mx-auto max-w-xl px-5 pb-16 sm:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">From your coach</p>
        <h1 className="mt-2 font-display text-4xl font-medium">Time swap</h1>
        {error ? <p className="mt-4 text-coral">{error}</p> : null}
        {data ? (
          <div className="mt-5 rounded-2xl bg-card p-5 ring-1 ring-line">
            <p className="text-sm text-muted">{data.coachName}</p>
            <p className="mt-2 font-semibold">Your lesson · {data.yourWhen}</p>
            {data.otherWhen ? (
              <p className="mt-1 text-sm">
                Swap with {data.otherLabel ?? "another student"} at {data.otherWhen}
              </p>
            ) : null}
            {data.note ? (
              <blockquote className="mt-4 rounded-xl bg-sage-3 px-4 py-3 text-sm text-ink-soft">
                {data.note}
              </blockquote>
            ) : null}
            {data.pending ? (
              <div className="mt-5 space-y-2">
                <Button size="field" disabled={busy} onClick={() => void decide("accepted")}>
                  Accept swap
                </Button>
                <Button variant="outline" size="field" disabled={busy} onClick={() => void decide("declined")}>
                  Keep my time
                </Button>
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted">
                {data.status === "accepted"
                  ? "This swap is confirmed."
                  : data.status === "declined"
                    ? "This swap did not go through."
                    : data.status === "cancelled"
                      ? "Your coach withdrew this swap."
                      : "Waiting on the other student."}
              </p>
            )}
          </div>
        ) : null}
        {done ? <p className="mt-4 text-sm text-ink-soft">{done}</p> : null}
        <Link to="/manage" className="mt-6 inline-block text-sm font-semibold text-forest">
          Your bookings
        </Link>
      </div>
    </main>
  );
}
