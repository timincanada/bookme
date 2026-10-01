import type { ReactNode } from "react";
import { Card } from "@/components/bookme/ui/card";
import { SectionHeader } from "@/components/bookme/ui/section-header";

export function SettingGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-[var(--space-section)]">
      <SectionHeader title={title} />
      <Card>
        <ul className="divide-y divide-line">{children}</ul>
      </Card>
    </section>
  );
}
