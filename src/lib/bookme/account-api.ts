import { createServerFn } from "@tanstack/react-start";
import { guardInput } from "./input-guard";
import { getSql, withTransaction } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { checkCoachDeletion, deactivateCoach, deleteStudent } from "./account-deletion";
import { coachForUser } from "./api";
import { getStripe } from "./stripe";

const CONFIRM_WORD = "DELETE";

export const deleteCoachAccount = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { confirm: string }) => guardInput(input))
  .handler(async ({ context, data }) => {
    if (String(data?.confirm || "").trim() !== CONFIRM_WORD) {
      return { ok: false as const, error: `Type ${CONFIRM_WORD} to confirm.` };
    }
    const sql = await getSql();
    const coach = await coachForUser(sql, context.userId);
    if (!coach) return { ok: false as const, error: "Sign in required" };
    const check = await checkCoachDeletion(sql, coach.id);
    if (!check.ok) return check;

    // Stop billing and disconnect payouts first (best effort; logged on failure).
    const stripe = getStripe();
    if (stripe && check.stripeSubscriptionId) {
      await stripe.subscriptions.cancel(check.stripeSubscriptionId).catch((err: unknown) => {
        console.error(JSON.stringify({ msg: "coach_delete_subscription_cancel_failed", coachId: coach.id, error: String(err) }));
      });
    }
    if (stripe && check.stripeAccountId) {
      await stripe.accounts.del(check.stripeAccountId).catch((err: unknown) => {
        console.error(
          JSON.stringify({ msg: "coach_delete_connect_disconnect_failed", coachId: coach.id, account: check.stripeAccountId, error: String(err) }),
        );
      });
    }

    const result = await withTransaction((tx) => deactivateCoach(tx, coach.id));
    if (!result.ok) return result;
    return { ok: true as const, purgeAfter: result.purgeAfter.toISOString() };
  });

export const deleteStudentAccount = createServerFn({ method: "POST" })
  .validator((input: { confirm: string }) => guardInput(input))
  .handler(async ({ data }) => {
    if (String(data?.confirm || "").trim() !== CONFIRM_WORD) {
      return { ok: false as const, error: `Type ${CONFIRM_WORD} to confirm.` };
    }
    const session = await import("./student-session.server");
    const me = await session.currentStudent();
    if (!me) return { ok: false as const, error: "Sign in with your email first." };
    const result = await withTransaction((tx) => deleteStudent(tx, me.studentId));
    if (!result.ok) return result;
    await session.clearStudentSession();
    return { ok: true as const };
  });
