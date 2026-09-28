import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";

/**
 * Privacy policy. Required as a public URL by the App Store and Google Play,
 * and linked from both apps' store listings.
 */
export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy policy · BookMe" },
      { name: "description", content: "What BookMe collects, why, who it is shared with, and how to delete it." },
    ],
  }),
  component: Privacy,
});

const UPDATED = "September 2026";

function Privacy() {
  return (
    <PageShell>
      <article className="mx-auto max-w-2xl px-5 py-16 sm:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">Legal</p>
        <h1 className="mt-3 font-display text-4xl font-medium">Privacy policy</h1>
        <p className="mt-2 text-sm text-muted">Last updated {UPDATED}</p>

        <div className="mt-8 space-y-4 leading-relaxed text-ink-soft">
          <p>
            BookMe is a booking page, calendar, messaging and payments tool for independent coaches. This policy covers
            the website at bookme.training and the BookMe and BookMe Student apps.
          </p>
          <p>
            Two kinds of people use BookMe. <strong className="text-ink">Coaches</strong> hold an account with us.{" "}
            <strong className="text-ink">Students</strong> book lessons with a coach; their details belong to that coach's
            records, and BookMe stores them on the coach's behalf.
          </p>

          <h2 className="pt-4 font-display text-2xl font-medium text-ink">What we collect</h2>
          <p>
            <strong className="text-ink">Coaches:</strong> name, email, password (stored hashed), booking page details
            (title, bio, photo, locations, hours, prices), time zone, lessons and client records you create, messages you
            send to students, subscription status, and — if you connect Stripe — the identifier of your Stripe account. We
            never see or store your card or bank details.
          </p>
          <p>
            <strong className="text-ink">Students:</strong> the name, email and optional phone number given when booking,
            the lessons booked, payment status of those lessons, messages exchanged with the coach, and one-time sign-in
            codes. If you use the app, a push notification token for your device.
          </p>
          <p>
            <strong className="text-ink">Everyone:</strong> ordinary server logs (IP address, browser, time of request)
            used to run and secure the service. BookMe shows no ads and runs no advertising or cross-site tracking.
          </p>

          <h2 className="pt-4 font-display text-2xl font-medium text-ink">Why we use it</h2>
          <p>
            To show a booking page, take and confirm bookings, send confirmations, reminders, sign-in codes and
            new-message notices, take payment, keep the coach's client records and messages, protect against abuse
            (rate limits, one-time codes), and meet accounting obligations.
          </p>

          <h2 className="pt-4 font-display text-2xl font-medium text-ink">Who it is shared with</h2>
          <p>
            Only with the service providers needed to run BookMe: Vercel (hosting), Neon (database, in North America),
            Stripe (payments and coach subscriptions), Resend (email), Apple and Google (push notifications to your own
            device), Google Maps (address search when a coach adds a location), and xAI (only for the optional coach
            assistant, when a coach uses it). We do not sell personal information, and we do not share it for
            advertising.
          </p>
          <p>
            A student's details are visible to the coach they booked with — and only to that coach. Coaches cannot see
            each other's clients. BookMe staff can see coach accounts and aggregate figures for support and billing;
            staff cannot read messages, and a support lookup of a student's bookings by email is recorded in an audit log.
          </p>

          <h2 className="pt-4 font-display text-2xl font-medium text-ink">How long we keep it</h2>
          <p>
            While the account is active. Sign-in codes expire after 30 minutes; a signed-in student session lasts 30
            days. When a coach deletes their account, the booking page goes offline immediately and the profile is
            removed; after 30 days the sign-in account is deleted and the coach's client details and messages are
            erased. Lesson and payment records required for accounting are kept without names or contact details. When a
            student deletes their account, sign-in, devices and messages are removed and the coach's past lessons keep
            only "Deleted student".
          </p>

          <h2 className="pt-4 font-display text-2xl font-medium text-ink">Your choices</h2>
          <p>
            Coaches can edit their details in the app (More → Account) and delete the account there. Students can sign in
            at{" "}
            <Link to="/manage" search={{ email: undefined, token: undefined }} className="font-semibold text-forest">
              bookme.training/manage
            </Link>{" "}
            and delete their account under Account. Step-by-step instructions:{" "}
            <Link to="/delete-account" className="font-semibold text-forest">
              bookme.training/delete-account
            </Link>
            . You can turn push notifications off in your phone's settings, and reply to any email to ask us for a copy
            of your data or to correct it.
          </p>

          <h2 className="pt-4 font-display text-2xl font-medium text-ink">Children</h2>
          <p>
            BookMe is for adults. Lessons are often booked for a child by a parent or guardian; in that case the account
            and the contact details belong to the adult. We do not knowingly create accounts for children under 13.
          </p>

          <h2 className="pt-4 font-display text-2xl font-medium text-ink">Where data is stored</h2>
          <p>
            Data is stored in North America. Our providers may process it in other countries; they are bound by contract
            to protect it.
          </p>

          <h2 className="pt-4 font-display text-2xl font-medium text-ink">Changes and contact</h2>
          <p>
            We will update this page when the product changes and move the date at the top. Questions, requests or
            complaints: reply to any BookMe email, or see{" "}
            <Link to="/help" className="font-semibold text-forest">
              Help
            </Link>
            . See also our{" "}
            <Link to="/terms" className="font-semibold text-forest">
              terms and cancellation policy
            </Link>
            .
          </p>
        </div>
      </article>
    </PageShell>
  );
}
