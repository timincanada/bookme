import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

/**
 * Primary lockup cropped from BOOKME LOGO ASSETS brand sheet (exact pixels).
 * Do not replace with a redrawn SVG. On forest surfaces, use the white reverse
 * PNG (not CSS invert of the cream-backed primary).
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
  const src = invert ? "/brand/bookme-logo-reverse.png" : "/brand/bookme-logo-primary.png";
  // Reverse is primary-FULL2 → white with 12px pad (804×208); primary is 780×184.
  const width = invert ? 804 : 780;
  const height = invert ? 208 : 184;

  return (
    <Link
      to={to}
      title="BookMe home"
      className={cn("inline-flex max-w-full cursor-pointer items-center", className)}
      aria-label="BookMe home"
    >
      <img
        src={src}
        alt="BookMe"
        className="h-7 max-w-full w-auto object-contain object-left sm:h-8"
        width={width}
        height={height}
        decoding="async"
      />
    </Link>
  );
}
