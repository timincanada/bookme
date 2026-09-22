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

export function payLabel(
  status?: string | null,
  method?: string | null,
  opts: { audience?: "coach" | "student"; seriesStatusLabel?: string | null } = {},
) {
  if (status === "not_tracked") {
    // Imported regular lessons: payment is a CRM note, never shown to students.
    if (opts.audience === "coach") {
      return { text: opts.seriesStatusLabel || "Payment tracked outside BookMe", kind: "series" as const };
    }
    return { text: "Arranged with coach", kind: "other" as const };
  }
  if (status === "paid") return { text: "Paid", kind: "paid" as const };
  if (status === "marked_offline") return { text: "Collected offline", kind: "offline" as const };
  if (status === "refunded") return { text: "Refunded", kind: "other" as const };
  if (status === "unpaid") return { text: "Unpaid", kind: "unpaid" as const };
  if (method === "cash") return { text: "Pay in person", kind: "unpaid" as const };
  return { text: status || "Pay in person", kind: "other" as const };
}
