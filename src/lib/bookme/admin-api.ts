/**
 * Operations console server functions. Every call resolves the caller's console
 * role first (verified email + staff/owner bootstrap); writes are recorded in admin_actions.
 */
import { createServerFn } from "@tanstack/react-start";
import { guardInput } from "./input-guard";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { can, exportFilename, toCsv, type AdminAbility, type PeriodKey } from "./admin-console";
import {
  addTeamMember,
  resolveAdminAccess,
  coachDetail,
  extendTrial,
  health,
  lessonsReport,
  listCoaches,
  listTeam,
  lookupStudent,
  recentActions,
  recordAction,
  removeTeamMember,
  revenue,
  setAccessGrant,
  setBanned,
  summary,
  type CoachSort,
} from "./admin-service";

const DENIED = "You don't have access";

async function authAdmin(userId: string, ability: AdminAbility = "view") {
  const sql = await getSql();
  const user = (
    await sql.query<{ email: string; emailVerified: boolean }>(
      `select email, "emailVerified" from "user" where id = $1`,
      [userId],
    )
  )[0];
  const access = await resolveAdminAccess(sql, user);
  if (!access.ok) return { ok: false as const, error: DENIED, reason: access.reason };
  if (!can(access.identity.role, ability)) return { ok: false as const, error: DENIED, reason: "NOT_STAFF" as const };
  return { ok: true as const, sql, me: access.identity };
}

export const adminSummary = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { period?: PeriodKey } = {}) => guardInput(input))
  .handler(async ({ context, data }) => {
    const gate = await authAdmin(context.userId);
    if (!gate.ok) return gate;
    const period = (["today", "week", "month", "all"] as const).includes(data?.period as PeriodKey)
      ? (data.period as PeriodKey)
      : "month";
    return {
      ok: true as const,
      role: gate.me.role,
      email: gate.me.email,
      summary: await summary(gate.sql, period),
      actions: (await recentActions(gate.sql, 10)).map(mapAction),
    };
  });

export const adminCoaches = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { search?: string; status?: string; sort?: CoachSort; offset?: number } = {}) => guardInput(input))
  .handler(async ({ context, data }) => {
    const gate = await authAdmin(context.userId);
    if (!gate.ok) return gate;
    return { ok: true as const, role: gate.me.role, ...(await listCoaches(gate.sql, data || {})) };
  });

export const adminCoach = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { id: string }) => guardInput(input))
  .handler(async ({ context, data }) => {
    const gate = await authAdmin(context.userId);
    if (!gate.ok) return gate;
    const detail = await coachDetail(gate.sql, String(data?.id || ""));
    if (!detail) return { ok: false as const, error: "Coach not found" };
    return {
      ok: true as const,
      role: gate.me.role,
      ...detail,
      actions: (await recentActions(gate.sql, 25, { type: "coach", id: String(data.id) })).map(mapAction),
    };
  });

export const adminRevenue = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { months?: number } = {}) => guardInput(input))
  .handler(async ({ context, data }) => {
    const gate = await authAdmin(context.userId);
    if (!gate.ok) return gate;
    const months = Math.min(24, Math.max(3, Math.floor(Number(data?.months) || 12)));
    return { ok: true as const, role: gate.me.role, months: await revenue(gate.sql, months) };
  });

export const adminLessons = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { from?: string; to?: string; coachId?: string; status?: string } = {}) => guardInput(input))
  .handler(async ({ context, data }) => {
    const gate = await authAdmin(context.userId);
    if (!gate.ok) return gate;
    return { ok: true as const, role: gate.me.role, ...(await lessonsReport(gate.sql, data || {})) };
  });

export const adminHealth = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const gate = await authAdmin(context.userId);
    if (!gate.ok) return gate;
    return { ok: true as const, role: gate.me.role, ...(await health(gate.sql)) };
  });

/** Support lookup: one student's bookings by email. Always audited. */
export const adminLookupStudent = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { email: string; note?: string }) => guardInput(input))
  .handler(async ({ context, data }) => {
    const gate = await authAdmin(context.userId, "lookup_student");
    if (!gate.ok) return gate;
    const result = await lookupStudent(gate.sql, String(data?.email || ""));
    if (!result.ok) return result;
    await recordAction(gate.sql, gate.me, {
      kind: "lookup_student",
      subjectType: "student_email",
      subjectId: result.email,
      detail: `${result.lessons.length} lessons`,
      note: String(data?.note || ""),
    });
    const { ok: _ok, ...payload } = result;
    return { ok: true as const, role: gate.me.role, ...payload };
  });

export const adminActOnCoach = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { coachId: string; action: "set_access" | "ban" | "unban" | "extend_trial"; grant?: string; days?: number; note?: string }) =>
    guardInput(input),
  )
  .handler(async ({ context, data }) => {
    const action = String(data?.action || "");
    const ability: AdminAbility =
      action === "extend_trial" ? "extend_trial" : action === "set_access" ? "set_access" : "ban_coach";
    const gate = await authAdmin(context.userId, ability);
    if (!gate.ok) return gate;
    const coachId = String(data?.coachId || "");
    const note = String(data?.note || "");

    if (action === "set_access") {
      const grant = String(data?.grant ?? "");
      const res = await setAccessGrant(gate.sql, coachId, grant);
      if (!res.ok) return res;
      await recordAction(gate.sql, gate.me, { kind: "set_access", subjectType: "coach", subjectId: coachId, detail: grant || "none", note });
      return { ok: true as const, message: `Access set to ${grant || "none"}.` };
    }
    if (action === "ban" || action === "unban") {
      const res = await setBanned(gate.sql, coachId, action === "ban");
      if (!res.ok) return res;
      await recordAction(gate.sql, gate.me, { kind: action, subjectType: "coach", subjectId: coachId, detail: "", note });
      return { ok: true as const, message: action === "ban" ? "Coach banned." : "Coach unbanned." };
    }
    if (action === "extend_trial") {
      const res = await extendTrial(gate.sql, coachId, Number(data?.days) || 14);
      if (!res.ok) return res;
      await recordAction(gate.sql, gate.me, {
        kind: "extend_trial",
        subjectType: "coach",
        subjectId: coachId,
        detail: `${res.days} days → ${res.trialEndsAt.slice(0, 10)}`,
        note,
      });
      return { ok: true as const, message: `Trial extended by ${res.days} days.` };
    }
    return { ok: false as const, error: "Unknown action" };
  });

export const adminTeam = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const gate = await authAdmin(context.userId, "manage_team");
    if (!gate.ok) return gate;
    return {
      ok: true as const,
      role: gate.me.role,
      team: (await listTeam(gate.sql)).map((t) => ({
        email: t.email,
        role: t.role,
        addedBy: t.added_by,
        createdAt: new Date(t.created_at).toISOString(),
      })),
      actions: (await recentActions(gate.sql, 25)).map(mapAction),
    };
  });

export const adminUpdateTeam = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { action: "add" | "remove"; email: string }) => guardInput(input))
  .handler(async ({ context, data }) => {
    const gate = await authAdmin(context.userId, "manage_team");
    if (!gate.ok) return gate;
    const add = data?.action === "add";
    const res = add ? await addTeamMember(gate.sql, String(data?.email || ""), gate.me.email) : await removeTeamMember(gate.sql, String(data?.email || ""));
    if (!res.ok) return res;
    await recordAction(gate.sql, gate.me, {
      kind: add ? "team_add" : "team_remove",
      subjectType: "staff",
      subjectId: res.email,
      detail: add ? "admin" : "",
    });
    return { ok: true as const, message: add ? `${res.email} can now open the console.` : `${res.email} removed.` };
  });

/** CSV or Excel export of coaches / revenue / lessons. */
export const adminExport = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { kind: "coaches" | "revenue" | "lessons"; format: "csv" | "xlsx"; from?: string; to?: string }) => guardInput(input))
  .handler(async ({ context, data }) => {
    const gate = await authAdmin(context.userId);
    if (!gate.ok) return gate;
    const kind = data?.kind === "revenue" || data?.kind === "lessons" ? data.kind : "coaches";
    const format = data?.format === "xlsx" ? "xlsx" : "csv";

    let rows: Record<string, unknown>[] = [];
    let columns: { key: string; header: string }[] = [];
    if (kind === "coaches") {
      const list = await listCoaches(gate.sql, { limit: 200, sort: "revenue" });
      rows = list.coaches as unknown as Record<string, unknown>[];
      columns = [
        { key: "name", header: "Coach" },
        { key: "email", header: "Email" },
        { key: "slug", header: "Page" },
        { key: "status", header: "Subscription" },
        { key: "plan", header: "Plan" },
        { key: "trialEndsAt", header: "Trial ends" },
        { key: "stripeConnected", header: "Stripe connected" },
        { key: "lessonsConfirmed", header: "Lessons" },
        { key: "lessonsUpcoming", header: "Upcoming" },
        { key: "clients", header: "Clients" },
        { key: "cardPaid", header: "Card paid (CAD)" },
        { key: "cashCollected", header: "Cash collected (CAD)" },
        { key: "platformFee", header: "Platform 5% (CAD)" },
        { key: "lastLessonAt", header: "Last lesson" },
      ];
    } else if (kind === "revenue") {
      rows = (await revenue(gate.sql, 24)) as unknown as Record<string, unknown>[];
      columns = [
        { key: "month", header: "Month" },
        { key: "cardPaid", header: "Card paid (CAD)" },
        { key: "platformFee", header: "Platform 5% (CAD)" },
        { key: "coachShare", header: "Coach share (CAD)" },
        { key: "cash", header: "Cash collected (CAD)" },
        { key: "refunded", header: "Refunded (CAD)" },
        { key: "cardCount", header: "Card payments" },
        { key: "refundCount", header: "Refunds" },
      ];
    } else {
      const report = await lessonsReport(gate.sql, { from: data?.from, to: data?.to, limit: 500 });
      rows = report.lessons as unknown as Record<string, unknown>[];
      columns = [
        { key: "startAt", header: "Start (UTC)" },
        { key: "coachName", header: "Coach" },
        { key: "student", header: "Student" },
        { key: "status", header: "Status" },
        { key: "source", header: "Source" },
        { key: "payMethod", header: "Payment method" },
        { key: "payStatus", header: "Payment status" },
        { key: "amountCad", header: "Amount (CAD)" },
      ];
    }

    const filename = exportFilename(kind, format);
    await recordAction(gate.sql, gate.me, { kind: "export", subjectType: "report", subjectId: kind, detail: format });

    if (format === "csv") {
      return { ok: true as const, filename, mime: "text/csv;charset=utf-8", base64: Buffer.from(toCsv(rows, columns), "utf8").toString("base64") };
    }
    const XLSX = await import("xlsx");
    const sheet = XLSX.utils.json_to_sheet(
      rows.map((r) => Object.fromEntries(columns.map((c) => [c.header, r[c.key] ?? ""]))),
      { header: columns.map((c) => c.header) },
    );
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, kind);
    const buf = XLSX.write(book, { type: "base64", bookType: "xlsx" }) as string;
    return {
      ok: true as const,
      filename,
      mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      base64: buf,
    };
  });

function mapAction(a: { id: string; actor_email: string; actor_role: string; kind: string; subject_type: string; subject_id: string; detail: string; note: string; created_at: string | Date }) {
  return {
    id: a.id,
    actor: a.actor_email,
    role: a.actor_role,
    kind: a.kind,
    subjectType: a.subject_type,
    subjectId: a.subject_id,
    detail: a.detail,
    note: a.note,
    at: new Date(a.created_at).toISOString(),
  };
}
