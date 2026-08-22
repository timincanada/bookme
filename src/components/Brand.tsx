import type { ReactNode } from "react";

export function Brand({ right }: { right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between py-4">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-sm font-bold text-white">B</span>
        <span className="text-lg font-semibold text-ink">BookMe</span>
      </div>
      {right}
    </div>
  );
}
