import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { runReminders } from "@/lib/bookme/remind-run";
import { purgeDeletedCoaches } from "@/lib/bookme/account-deletion";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // not configured → closed
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function handle(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sql = await getSql();
  const result = await runReminders(sql);
  const purge = await purgeDeletedCoaches(sql);
  return Response.json({ ...result, purgedCoaches: purge.purged });
}

export const Route = createFileRoute("/api/cron/reminders")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
    },
  },
});
