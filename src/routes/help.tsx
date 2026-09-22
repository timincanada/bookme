import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";

export const Route = createFileRoute("/help")({ component: Help });

function Help() {
  return (
    <PageShell>
      <article className="mx-auto max-w-2xl px-5 py-16 sm:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">
          Help
        </p>
        <h1 className="mt-3 font-display text-4xl font-medium">Need a hand?</h1>
        <p className="mt-4 text-ink-soft">
          Booking questions go to your coach. Product questions — start here.
        </p>
        <dl className="mt-10 space-y-6">
          <div>
            <dt className="font-semibold">How do I cancel?</dt>
            <dd className="mt-1 text-muted">
              Free reschedule or cancel until 24 hours before via{" "}
              <Link to="/manage" className="text-forest underline">Manage a booking</Link>.
              Inside 24 hours, send a request with a note — your coach decides.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Can my coach swap my time with someone else?</dt>
            <dd className="mt-1 text-muted">
              Yes. You’ll get an email with their note and a link to accept or keep your time. Nothing moves unless both students agree.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">When am I charged?</dt>
            <dd className="mt-1 text-muted">
              Lessons confirm immediately. Pay your coach in person.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">How do I open my page?</dt>
            <dd className="mt-1 text-muted">
              <Link to="/start" className="text-forest underline">
                Start free
              </Link>{" "}
              to create a page, then share the link. Preview a live example on{" "}
              <Link to="/$slug" params={{ slug: "tim-zhang" }} className="text-forest underline">
                Tim Zhang’s page
              </Link>
              .
            </dd>
          </div>
        </dl>
      </article>
    </PageShell>
  );
}
