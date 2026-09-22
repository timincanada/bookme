import { Link } from "@tanstack/react-router";
import { Logo } from "./logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-paper">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">
            More time coaching. Less time scheduling. One link. They pick a slot.
            You show up to teach.
          </p>
        </div>
        <FooterCol
          title="Product"
          links={[
            ["/for-coaches", "For coaches"],
            ["/for-clubs", "For clubs"],
            ["/pricing", "Pricing"],
          ]}
        />
        <FooterCol
          title="Company"
          links={[
            ["/how-it-works", "How it works"],
            ["/help", "Help"],
            ["/login", "Log in"],
            ["/manage", "Manage a booking"],
          ]}
        />
        <FooterCol
          title="Legal"
          links={[["/terms", "Terms & cancellation"]]}
        />
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-5 py-5 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span>© {new Date().getFullYear()} BookMe. Built for independent coaches.</span>
          <span>Markham · Toronto · wherever you teach.</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: Array<readonly [string, string]>;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
        {title}
      </p>
      <ul className="mt-3 space-y-2">
        {links.map(([to, label]) => (
          <li key={to}>
            <Link to={to} className="text-sm text-ink-soft hover:text-forest">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
