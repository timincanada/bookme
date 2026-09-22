import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

/**
 * Primary lockup cropped from BOOKME LOGO ASSETS brand sheet (exact pixels).
 * Do not replace with a redrawn SVG. On forest surfaces, CSS-invert the primary PNG.
 */
export function Logo({
  className,
  to = "/",
  invert,
}: {
  className?: string;
  to?: string;
  invert?: boolean;
}) {
  return (
    <Link to={to} className={cn("inline-flex items-center", className)} aria-label="BookMe">
      <img
        src="/brand/bookme-logo-primary.png"
        alt="BookMe"
        className={cn("h-7 w-auto sm:h-8", invert && "brightness-0 invert")}
        width={780}
        height={184}
        decoding="async"
      />
    </Link>
  );
}
