/**
 * Push notifications (v1: new message, new booking, cancellation, move request).
 *
 * Delivery is behind a transport. None is installed until the APNs key (.p8) and
 * Firebase credentials are provided — see docs/mobile/README.md. Without a
 * transport, pushes are logged and skipped. Notification text never includes
 * message bodies.
 */
import type { Sql } from "@/lib/db";
import { normalizeEmail } from "./email";

type QuerySql = Pick<Sql, "query">;

export type PushMessage = { title: string; body: string; path: string };
export type PushDevice = { id: string; platform: "ios" | "android"; token: string };
export type PushResult = { ok: boolean; invalidToken?: boolean };
export type PushTransport = { name: string; send(device: PushDevice, message: PushMessage): Promise<PushResult> };

let transport: PushTransport | null = null;

export function setPushTransport(next: PushTransport | null) {
  transport = next;
}

/** Which credentials are present (for docs/ops; sending still needs a transport). */
export function pushCredentials(env: Record<string, string | undefined> = process.env) {
  return {
    apns: Boolean(env.APNS_KEY_ID && env.APNS_TEAM_ID && env.APNS_PRIVATE_KEY && env.APNS_BUNDLE_ID),
    fcm: Boolean(env.FCM_PROJECT_ID && env.FCM_SERVICE_ACCOUNT_JSON),
  };
}

async function deliver(sql: QuerySql, devices: PushDevice[], message: PushMessage) {
  if (!devices.length) return { sent: 0, skipped: 0 };
  if (!transport) {
    console.log(JSON.stringify({ msg: "push_skipped_no_transport", devices: devices.length, path: message.path }));
    return { sent: 0, skipped: devices.length };
  }
  let sent = 0;
  for (const d of devices) {
    try {
      const r = await transport.send(d, message);
      if (r.ok) sent++;
      if (r.invalidToken) await sql.query(`delete from device_tokens where id = $1`, [d.id]);
    } catch (err) {
      console.error(JSON.stringify({ msg: "push_failed", transport: transport.name, error: String(err) }));
    }
  }
  return { sent, skipped: 0 };
}

export async function pushToCoach(sql: QuerySql, coachId: string, message: PushMessage) {
  const devices = await sql.query<PushDevice>(
    `select d.id, d.platform, d.token from device_tokens d join coaches c on c.id = d.coach_id
     where d.coach_id = $1 and c.deleted_at is null`,
    [coachId],
  );
  return deliver(sql, devices, message);
}

export async function pushToStudentEmail(sql: QuerySql, email: string | null | undefined, message: PushMessage) {
  if (!email) return { sent: 0, skipped: 0 };
  const devices = await sql.query<PushDevice>(
    `select d.id, d.platform, d.token from device_tokens d join students s on s.id = d.student_id
     where lower(s.email) = $1`,
    [normalizeEmail(email)],
  );
  return deliver(sql, devices, message);
}

/** Fire-and-forget wrapper: a push problem never breaks the request. */
export function pushLater(task: () => Promise<unknown>) {
  void task().catch((err) => console.error(JSON.stringify({ msg: "push_error", error: String(err) })));
}

export async function registerDevice(
  sql: QuerySql,
  owner: { coachId: string } | { studentId: string },
  input: { token: string; platform: string },
) {
  const token = String(input.token || "").trim();
  const platform = input.platform === "ios" || input.platform === "android" ? input.platform : null;
  if (!platform || token.length < 16 || token.length > 4096) return { ok: false as const, error: "Invalid device" };
  const coachId = "coachId" in owner ? owner.coachId : null;
  const studentId = "studentId" in owner ? owner.studentId : null;
  await sql.query(
    `insert into device_tokens (id, platform, token, coach_id, student_id)
     values (gen_random_uuid()::text, $1, $2, $3, $4)
     on conflict (token) do update
       set platform = excluded.platform, coach_id = excluded.coach_id,
           student_id = excluded.student_id, last_seen_at = now()`,
    [platform, token, coachId, studentId],
  );
  return { ok: true as const };
}
