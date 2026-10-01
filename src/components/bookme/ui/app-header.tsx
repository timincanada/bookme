import { AccountMenu } from "@/components/bookme/account-menu";
import { Logo } from "@/components/logo";

/** Logged-in mobile header: logo left, account avatar right. */
export function AppHeader({ name, email }: { name?: string | null; email?: string | null }) {
  return (
    <header className="app-header flex items-center justify-between gap-3 border-b border-line/80 bg-paper px-[var(--space-page)] md:hidden">
      <Logo to="/app" className="[&_img]:h-[26px] [&_img]:max-w-[142px]" />
      <AccountMenu name={name} email={email} avatarClassName="size-10" />
    </header>
  );
}
