import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";

export const Route = createFileRoute("/terms")({ component: Terms });

function Terms() {
  return (
    <PageShell>
      <article className="mx-auto max-w-2xl px-5 py-16 sm:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">
          Legal
        </p>
        <h1 className="mt-3 font-display text-4xl font-medium">Terms & cancellation</h1>
        <div className="mt-8 space-y-4 text-ink-soft leading-relaxed">
          <p>
            BookMe is a booking page, calendar, and payments tool for independent coaches and
            clubs. By creating a page or booking a lesson you agree to use the product in good
            faith.
          </p>
          <h2 className="pt-4 font-display text-2xl font-medium text-ink">Cancellation</h2>
          <p>
            Clients may cancel free of charge up to 24 hours before a lesson. Inside that window
            the coach may keep the fee. Coaches who cancel a confirmed lesson should refund in
            full.
          </p>
          <h2 className="pt-4 font-display text-2xl font-medium text-ink">Payments</h2>
          <p>
            Lesson prices are set by the coach. Applicable HST is added at checkout for Ontario
            bookings. BookMe does not take a cut of lesson fees on paid plans.
          </p>
        </div>
      </article>
    </PageShell>
  );
}
