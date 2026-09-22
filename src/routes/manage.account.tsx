import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { deleteStudentAccount } from "@/lib/bookme/account-api";
import { useStudent } from "@/lib/bookme/student-context";
import { forgetDevice } from "@/lib/native/device";

export const Route = createFileRoute("/manage/account")({ component: StudentAccount });

function StudentAccount() {
  const { email, signedOut } = useStudent();
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function remove() {
    setBusy(true);
    setError("");
    await forgetDevice();
    const res = await deleteStudentAccount({ data: { confirm } });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setDone(true);
    setTimeout(signedOut, 2500);
  }

  if (done) return <p className="mt-6 rounded-2xl bg-sage-3 p-4 text-forest">Your account was deleted.</p>;
  return (
    <section className="mt-6 rounded-2xl bg-card p-5 ring-1 ring-line">
      <h2 className="font-display text-2xl">Delete account</h2>
      <p className="mt-1 text-sm text-muted">{email}</p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink-soft">
        <li>Your sign-in, messages and devices are deleted.</li>
        <li>Coaches keep your past lessons, shown as "Deleted student" without your name, email or phone.</li>
        <li>Upcoming lessons are not cancelled — cancel them first if you won't attend.</li>
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
  );
}
