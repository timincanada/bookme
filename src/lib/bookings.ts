export type BookingBucket = "upcoming" | "completed" | "cancelled";

export function bookingBucket(status: string, startAt: Date, now = new Date()): BookingBucket {
  if (status === "cancelled" || status === "expired") return "cancelled";
  if (status === "confirmed" && startAt.getTime() < now.getTime()) return "completed";
  if (status === "confirmed" || status === "held") return "upcoming";
  return "cancelled";
}

export function payLabel(status?: string | null, method?: string | null) {
  if (status === "paid") return { text: "Paid", kind: "paid" as const };
  if (status === "marked_offline") return { text: "Collected offline", kind: "offline" as const };
  if (status === "refunded") return { text: "Refunded", kind: "other" as const };
  if (method === "cash" && status === "unpaid") return { text: "Unpaid", kind: "unpaid" as const };
  return { text: status || "Unpaid", kind: "other" as const };
}
