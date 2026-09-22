import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

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
    <Link
      to={to}
      className={cn(
        "inline-flex items-center font-sans text-xl font-semibold tracking-tight",
        invert ? "text-on-forest" : "text-forest",
        className,
      )}
    >
      BookMe
    </Link>
  );
}
