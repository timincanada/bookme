export type BookingBucket = "upcoming" | "completed" | "cancelled";

export function bookingBucket(status: string, startAt: Date, now = new Date()): BookingBucket {
  if (status === "cancelled" || status === "expired") return "cancelled";
  if (status === "confirmed" && startAt.getTime() < now.getTime()) return "completed";
  if (status === "confirmed" || status === "held") return "upcoming";
  return "cancelled";
}

const STATUS_COPY: Record<string, string> = {
  confirmed: "Confirmed",
  held: "Held",
  cancelled: "Cancelled",
  expired: "Expired",
};

export function lessonStatusLabel(status: string) {
  return STATUS_COPY[status] || status;
}

export function payLabel(status?: string | null, method?: string | null) {
  if (status === "paid") return { text: "Paid", kind: "paid" as const };
  if (status === "marked_offline") return { text: "Collected offline", kind: "offline" as const };
  if (status === "refunded") return { text: "Refunded", kind: "other" as const };
  if (status === "unpaid") return { text: "Unpaid", kind: "unpaid" as const };
  return { text: status || "Unpaid", kind: "other" as const };
}
