import type { ReactNode } from "react";

export function Brand({ right }: { right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between py-4">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#10B981] text-white font-bold">B</span>
        <span className="text-lg font-semibold text-slate-900">BookMe</span>
      </div>
      {right}
    </div>
  );
}
