import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Consistent horizontal page padding and the gap under the app header. */
export function PageFrame({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className={cn("app-page mx-auto w-full min-w-0 max-w-3xl", wide && "max-w-6xl")}>{children}</div>
  );
}
