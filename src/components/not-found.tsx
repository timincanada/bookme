import { Link } from "@tanstack/react-router";
import { Logo } from "./logo";

export function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-paper px-6 text-center">
      <Logo />
      <h1 className="font-display text-4xl font-medium text-ink">Page not found</h1>
      <p className="max-w-md text-muted">
        That link doesn’t lead to a booking page. Head home, or create your own.
      </p>
      <div className="mt-2 flex gap-3">
        <Link
          to="/"
          className="inline-flex h-11 items-center rounded-full bg-forest px-5 text-sm font-semibold text-on-forest"
        >
          Home
        </Link>
        <Link
          to="/start"
          className="inline-flex h-11 items-center rounded-full border border-line px-5 text-sm font-semibold"
        >
          Start free
        </Link>
      </div>
    </main>
  );
}
