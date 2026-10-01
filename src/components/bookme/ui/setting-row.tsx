import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

export const SETTING_ROUTES = [
  "/app/more/hours",
  "/app/more/locations",
  "/app/more/lessons",
  "/app/setup",
  "/app/assistant",
  "/app/more/assistant",
  "/app/more/payments",
  "/app/billing",
  "/app/more/account",
] as const;

export type SettingRoute = (typeof SETTING_ROUTES)[number];

export function SettingRow({ to, label }: { to: SettingRoute; label: string }) {
  return (
    <li>
      <Link
        to={to}
        className="flex min-h-12 items-center justify-between gap-3 px-4 py-3 text-base font-medium text-ink hover:bg-paper"
      >
        <span className="min-w-0 break-words">{label}</span>
        <ChevronRight className="size-4 shrink-0 text-muted" strokeWidth={1.75} aria-hidden />
      </Link>
    </li>
  );
}
