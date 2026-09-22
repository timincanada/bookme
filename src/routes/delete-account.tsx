import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/logo";

/** Public account-deletion page (store listing "delete account" URL). */
export const Route = createFileRoute("/delete-account")({
  head: () => ({ meta: [{ title: "Delete your BookMe account" }] }),
  component: DeleteAccountInfo,
});

function DeleteAccountInfo() {
  return (
    <main className="min-h-screen bg-paper">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <Logo />
        <h1 className="mt-10 font-display text-4xl font-medium">Delete your BookMe account</h1>
        <p className="mt-3 text-ink-soft">
          You can delete your account yourself, in the BookMe app or on this website. It takes effect right away.
        </p>

        <section className="mt-8 rounded-2xl bg-card p-5 ring-1 ring-line">
          <h2 className="font-display text-2xl">Coaches</h2>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-ink-soft">
            <li>
              Sign in at <Link to="/login" className="font-semibold text-forest">bookme.training/login</Link> or open the app.
            </li>
            <li>Go to More → Account → Delete account, type DELETE and confirm.</li>
          </ol>
          <p className="mt-4 text-sm font-semibold">What happens</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink-soft">
            <li>Your booking page goes offline, you are signed out everywhere, and your plan is cancelled.</li>
            <li>Your Stripe payouts connection is removed from BookMe.</li>
            <li>Your name, photo, bio, contact details and location addresses are removed at once.</li>
            <li>
              After 30 days your sign-in account is permanently deleted, and your clients' names, contact details, notes
              and messages are erased.
            </li>
            <li>
              Lesson and payment records required for accounting are kept without names or contact details.
            </li>
            <li>You need to cancel or finish upcoming lessons before deleting.</li>
          </ul>
        </section>

        <section className="mt-6 rounded-2xl bg-card p-5 ring-1 ring-line">
          <h2 className="font-display text-2xl">Students</h2>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-ink-soft">
            <li>
              Open <Link to="/manage" search={{ email: undefined, token: undefined }} className="font-semibold text-forest">bookme.training/manage</Link>{" "}
              (or the app) and sign in with the code we email you.
            </li>
            <li>Go to Account → Delete account, type DELETE and confirm.</li>
          </ol>
          <p className="mt-4 text-sm font-semibold">What happens</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink-soft">
            <li>Your sign-in, sessions, devices and messages are deleted.</li>
            <li>
              Your name, email and phone are removed from every coach you booked with. Coaches keep the lesson history,
              shown as "Deleted student".
            </li>
            <li>Upcoming lessons are not cancelled automatically — cancel them first if you won't attend.</li>
          </ul>
        </section>

        <p className="mt-8 text-sm text-muted">
          Questions? See <Link to="/help" className="font-semibold text-forest">Help</Link>.
        </p>
      </div>
    </main>
  );
}
