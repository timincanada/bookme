import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";
import { deleteCoachAccount } from "@/lib/bookme/account-api";
import { useCoach } from "@/lib/bookme/coach-context";
import { forgetDevice } from "@/lib/native/device";

export const Route = createFileRoute("/app/more/account")({ component: CoachAccount });

function CoachAccount() {
  const { coach } = useCoach();
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function signOut() {
    await forgetDevice();
    await authClient.signOut().catch(() => undefined);
    window.location.assign("/welcome");
  }

  async function remove() {
    setBusy(true);
    setError("");
    await forgetDevice();
    const res = await deleteCoachAccount({ data: { confirm } });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    await authClient.signOut().catch(() => undefined);
    window.location.assign("/delete-account");
  }

  if (!coach) return null;
  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <Link to="/app/more" className="type-action text-sm font-semibold text-forest">
        More
      </Link>
      <h1 className="mt-3 font-display text-3xl font-medium">Account</h1>
      <p className="mt-1 text-muted">{coach.email}</p>
      <Button variant="outline" size="field" className="mt-5" onClick={() => void signOut()}>
        Sign out
      </Button>

      <section className="mt-10 rounded-2xl bg-card p-5 ring-1 ring-line">
        <h2 className="type-section font-display text-2xl">Delete account</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink-soft">
          <li>Your booking page goes offline and you are signed out on every device.</li>
          <li>Your plan is cancelled and your Stripe payouts connection is removed.</li>
          <li>Your profile is removed now; your sign-in and clients' personal details are erased after 30 days.</li>
          <li>Lesson and payment records are kept without names for accounting.</li>
          <li>Cancel or finish upcoming lessons first.</li>
        </ul>
        <label className="mt-5 block">
          <span className="mb-1.5 block text-sm font-medium">Type DELETE to confirm</span>
          <input className="field" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoCapitalize="characters" autoComplete="off" />
        </label>
        {error ? <p className="mt-3 text-sm font-semibold text-coral">{error}</p> : null}
        <Button
          size="field"
          className="mt-4 bg-coral hover:bg-coral/90"
          disabled={busy || confirm.trim() !== "DELETE"}
          onClick={() => void remove()}
        >
          Delete my account
        </Button>
      </section>
    </div>
  );
}
