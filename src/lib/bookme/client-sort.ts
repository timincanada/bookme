export type ClientSort = "recent" | "az" | "booked";

export type SortableClient = {
  name: string;
  email: string;
  n?: number | string | null;
  last_at?: string | Date | null;
};

export function filterClients<T extends SortableClient>(rows: T[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q));
}

function byName(a: SortableClient, b: SortableClient) {
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

function recentStamp(value: string | Date | null | undefined) {
  if (!value) return 0;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : 0;
}

/** Recent uses the latest lesson start already counted on the client row. Most booked uses that lesson count. */
export function sortClients<T extends SortableClient>(rows: T[], sort: ClientSort) {
  const copy = rows.slice();
  copy.sort((a, b) => {
    if (sort === "az") return byName(a, b);
    if (sort === "booked") {
      const delta = Number(b.n || 0) - Number(a.n || 0);
      if (delta) return delta;
      return byName(a, b);
    }
    const delta = recentStamp(b.last_at) - recentStamp(a.last_at);
    if (delta) return delta;
    return byName(a, b);
  });
  return copy;
}
