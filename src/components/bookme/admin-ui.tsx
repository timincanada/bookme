import { Download } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatCad } from "@/lib/bookme/admin-console";
import { adminExport } from "@/lib/bookme/admin-api";
import { cn } from "@/lib/utils";

export function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-card p-4 ring-1 ring-line">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-1.5 font-display text-2xl font-medium tabular-nums">{value}</p>
      {sub ? <p className="text-xs text-muted">{sub}</p> : null}
    </div>
  );
}

export function Money({ amount }: { amount: number }) {
  return <span className="tabular-nums">{formatCad(amount)}</span>;
}

export function Chip({ tone = "muted", children }: { tone?: "muted" | "good" | "warn" | "bad"; children: React.ReactNode }) {
  const tones = {
    muted: "bg-paper-2 text-muted",
    good: "bg-sage-3 text-forest",
    warn: "bg-cream text-ink",
    bad: "bg-coral/15 text-coral",
  };
  return <span className={cn("inline-block rounded-full px-2 py-0.5 text-xs font-semibold", tones[tone])}>{children}</span>;
}

/** Scrollable table on phones; the first column stays readable. */
export function TableShell({ head, children }: { head: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-2xl bg-card ring-1 ring-line">
      <table className="w-full min-w-[42rem] border-collapse text-sm">
        <thead className="bg-paper-2 text-left text-xs uppercase tracking-wide text-muted">{head}</thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}

export function ExportButtons({ kind, from, to }: { kind: "coaches" | "revenue" | "lessons"; from?: string; to?: string }) {
  const [busy, setBusy] = useState("");
  async function run(format: "csv" | "xlsx") {
    setBusy(format);
    const res = await adminExport({ data: { kind, format, from, to } });
    setBusy("");
    if (!res.ok) return;
    const bytes = Uint8Array.from(atob(res.base64), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: res.mime }));
    const a = document.createElement("a");
    a.href = url;
    a.download = res.filename;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" disabled={Boolean(busy)} onClick={() => void run("csv")}>
        <Download className="mr-1.5 size-4" strokeWidth={1.75} />
        CSV
      </Button>
      <Button variant="outline" size="sm" disabled={Boolean(busy)} onClick={() => void run("xlsx")}>
        <Download className="mr-1.5 size-4" strokeWidth={1.75} />
        Excel
      </Button>
    </div>
  );
}
