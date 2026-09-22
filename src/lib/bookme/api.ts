import { createServerFn } from "@tanstack/react-start";
import { guardInput } from "./input-guard";
import { getSql, lockCoachSchedule, withTransaction, type Sql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { looksLikeImportRequest, nextWeekdayKey, parseAssistant, shiftDateKey, signEmailAsCoach, upcomingLessons, type AssistantAction, type Capability } from "./assistant";
import { logAssistantFailure, resolveAssistantProvider } from "./assistant-provider";
import { normalizeAssistantName } from "./assistant-name";
import { bookingBucket, lessonStatusLabel, payLabel } from "./bookings";
import { DEMO_COACH, DEMO_STUDENTS } from "./demo";
import { looksLikeEmail, normalizeEmail } from "./email";
import { canMoveLesson, canSelfReschedule, holdExpiresAt, statusAfterReschedule } from "./hold";
import { type HourSegment, validateWeeklyHours } from "./hours";
import { isWithinBookAhead, lastBookableDateKey, normalizeBookAheadDays } from "./book-ahead";
import { pickLocation } from "./location";
import { makeToken } from "./magic";
import {
  changeMails,
  coachSwapRequestMail,
  recurringAddedMail,
  requestResolvedMail,
  sendMail,
  studentMessageMail,
  studentMoveRequestMails,
} from "./mail";
import { notifyLessonConfirmed } from "./mail-send";
import { pushLater, pushToCoach, pushToStudentEmail } from "./push";
import { canUseMethod, enabledMethods, normalizeAccepted } from "./payments";
import { cityFromAddressComponents, googleMapsApiKey, isPlacesConfigured, type PlaceSuggestion } from "./places";
import { runReminders } from "./remind-run";
import { afterPartyDecision, ANOTHER_STUDENT, clipNote, firstName, isOpenRequest, swapPlan, viewerRequestView } from "./requests";
import { canCopyBookingLink, isSetupComplete, slugifyName, sportFromTitle } from "./setup";
import { isReservedSlug } from "./booking-link";
import { coachTimezone, openSlots, slotDateKey } from "./slots";
import { appleWalletSigningConfigured } from "./apple-wallet/pass-config";
import { appUrl, getStripe, stripeConfigured } from "./stripe";
import { TRIAL_DAYS, hasCapability, planCapabilities, priceIdForPlan } from "./subscription";
import { expireStaleTrial } from "./subscription-sync";
import { addDaysKey, dateKeyAt, formatDateKey, formatTime, formatWhen, minutesAt, todayKey, weekdayOf, zonedInstant, zonedInstantExact } from "./time";
import { DEFAULT_TIMEZONE, isValidTimezone } from "./timezone";
import {
  conflictFor,
  detectLang,
  isLessonDuration,
  isOutsideHours,
  LESSON_DURATIONS,
  paymentStatusLabel,
  recapImport,
  type RecurringPreview,
  type RecurringRuleInput,
} from "./recurring";
import { buildImportPlan, confirmImport, type ImportCoach, type ImportDone } from "./recurring-service";
import { coachUnreadCount } from "./messages-service";
import { findOrCreateCoachClient, getCoachClient, listCoachClientNames, listCoachClients, saveCoachClientNote } from "./clients-db";
import { audioFilename, capSpokenText, speakableText, spokenFromTurn, ttsLanguage } from "./voice";
import { extractClientSecret, REALTIME_WS_URL, TOKEN_TTL_SECONDS, VOICE_ID } from "./realtime";

function newId() {
  return crypto.randomUUID();
}

function asDate(value: string | Date | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

function bool(value: unknown) {
  return value === true || value === "t" || value === "true";
}

function tzOf(value: string | null | undefined) {
  return value && isValidTimezone(value) ? value : DEFAULT_TIMEZONE;
}

/** Lesson length: the per-lesson value when set (imports), else the service's. */
const DURATION_SQL = "coalesce(l.duration_min, s.duration)";

export type CoachRow = {
  id: string;
  user_id: string | null;
  slug: string;
  name: string;
  title: string;
  sport: string;
  city: string;
  timezone: string;
  languages: string;
  photo_url: string | null;
  headline: string;
  bio: string;
  notes: string;
  email: string;
  subscription_status: string;
  plan: string;
  trial_ends_at: string | Date | null;
  accept_card: boolean | string;
  accept_cash: boolean | string;
  banned: boolean | string;
  access_grant: string;
  stripe_account_id?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  book_ahead_days?: number | string | null;
  assistant_name?: string | null;
};

type ServiceRow = { id: string; name: string; duration: number; price_cad: number };
type LocationRow = {
  id: string;
  name: string;
  address: string;
  kind: string;
  active: boolean | string;
  place_id?: string | null;
  lat?: number | null;
  lng?: number | null;
  verified?: boolean | string;
};

async function authUser(sql: Sql, userId: string) {
  const rows = await sql.query<{ id: string; name: string; email: string; emailVerified: boolean }>(
    `select id, name, email, "emailVerified" from "user" where id = $1`,
    [userId],
  );
  return rows[0] ?? null;
}

export async function loadCoachBundle(sql: Pick<Sql, "query">, coach: CoachRow) {
  const services = await sql.query<ServiceRow>(
    `select id, name, duration, price_cad from services where coach_id = $1 order by name`,
    [coach.id],
  );
  const locations = await sql.query<LocationRow>(
    `select id, name, address, kind, active, place_id, lat, lng, verified from locations where coach_id = $1 order by name`,
    [coach.id],
  );
  const hours = await sql.query<{ weekday: number; start_min: number; end_min: number }>(
    `select weekday, start_min, end_min from weekly_hours where coach_id = $1 order by weekday, start_min`,
    [coach.id],
  );
  const activeLocations = locations.filter((l) => bool(l.active));
  const setup = isSetupComplete({
    title: coach.title,
    timezone: coach.timezone,
    service: services[0] ? { duration: services[0].duration, priceCad: services[0].price_cad } : null,
    locationCount: activeLocations.length,
    hourCount: hours.length,
  });
  const open = canCopyBookingLink(setup, coach.subscription_status, asDate(coach.trial_ends_at), {
    banned: bool(coach.banned),
    accessGrant: coach.access_grant,
  });
  return { services, locations, activeLocations, hours, setup, open };
}

function publicCoach(coach: CoachRow, bundle: Awaited<ReturnType<typeof loadCoachBundle>>) {
  return {
    id: coach.id,
    slug: coach.slug,
    name: coach.name,
    title: coach.title,
    sport: coach.sport || sportFromTitle(coach.title),
    city: coach.city,
    languages: coach.languages,
    photoUrl: coach.photo_url,
    headline: coach.headline,
    bio: coach.bio,
    notes: coach.notes ? coach.notes.split("\n").filter(Boolean) : [],
    open: bundle.open,
    acceptCash: bool(coach.accept_cash),
    acceptCard: bool(coach.accept_card),
    payMethods: enabledMethods(bool(coach.accept_card), bool(coach.accept_cash), coach.stripe_account_id),
    services: bundle.services.map((s) => ({
      id: s.id,
      name: s.name,
      duration: s.duration,
      priceCad: s.price_cad,
    })),
    locations: bundle.activeLocations.map((l) => ({
      id: l.id,
      name: l.name,
      address: l.address,
      kind: l.kind,
    })),
    bookAheadDays: normalizeBookAheadDays(coach.book_ahead_days),
    timezone: tzOf(coach.timezone),
    today: todayKey(tzOf(coach.timezone)),
  };
}

export const listPublicCoaches = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await getSql();
  const coaches = await sql.query<CoachRow>(`select * from coaches where banned = false and deleted_at is null order by name`);
  const out = [];
  for (const coach of coaches) {
    const bundle = await loadCoachBundle(sql, coach);
    if (!bundle.open && !coach.user_id) {
      // Seed coaches are granted paid; still list them if setup is complete.
    }
    if (bundle.setup) out.push(publicCoach(coach, bundle));
  }
  return out;
});

export const getPublicCoach = createServerFn({ method: "GET" })
  .validator((input: { slug: string }) => guardInput(input))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const slug = data.slug === "alex-rivera" ? DEMO_COACH.slug : data.slug;
    if (slug === DEMO_COACH.slug) {
      try {
        await ensureDemoReady(sql);
      } catch {
        // Still try to load whatever is already there.
      }
    }
    const rows = await sql.query<CoachRow>(`select * from coaches where slug = $1 and deleted_at is null limit 1`, [slug]);
    const coach = rows[0];
    if (!coach) return null;
    const bundle = await loadCoachBundle(sql, coach);
    return publicCoach(coach, bundle);
  });

export const getOpenSlots = createServerFn({ method: "GET" })
  .validator((input: { slug: string; date: string; duration?: number }) => guardInput(input))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql.query<CoachRow>(`select * from coaches where slug = $1 and deleted_at is null limit 1`, [data.slug]);
    const coach = rows[0];
    if (!coach) return { slots: [] as string[], locations: [] as { id: string; name: string; address: string }[], duration: 60, coachName: "", timezone: DEFAULT_TIMEZONE, today: todayKey(DEFAULT_TIMEZONE) };
    const bundle = await loadCoachBundle(sql, coach);
    const duration = data.duration || bundle.services[0]?.duration || 60;
    const bookAheadDays = normalizeBookAheadDays(coach.book_ahead_days);
    const tz = tzOf(coach.timezone);
    const today = todayKey(tz);
    const lastDate = lastBookableDateKey(bookAheadDays, today);
    const inWindow = isWithinBookAhead(data.date, bookAheadDays, today);
    const slots = bundle.open && inWindow ? await openSlots(sql, coach.id, data.date, duration) : [];
    return {
      slots,
      locations: bundle.activeLocations.map((l) => ({ id: l.id, name: l.name, address: l.address })),
      duration,
      coachName: coach.name,
      open: bundle.open,
      bookAheadDays,
      lastDate,
      timezone: tz,
      today,
    };
  });

export const getCoachOpenSlots = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { date: string; duration?: number }) => guardInput(input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const coach = await coachForUser(sql, context.userId);
    if (!coach) return { slots: [] as string[], timezone: DEFAULT_TIMEZONE };
    const bundle = await loadCoachBundle(sql, coach);
    const duration = data.duration || bundle.services[0]?.duration || 60;
    const slots = await openSlots(sql, coach.id, data.date, duration);
    return { slots, timezone: tzOf(coach.timezone) };
  });

export const createBooking = createServerFn({ method: "POST" })
  .validator((input: { slug: string; start: string; name: string; email: string; locationId?: string; serviceId?: string; phone?: string; method?: "cash" | "card" }) => guardInput(input))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const email = normalizeEmail(data.email);
    if (!data.slug || !data.start || !data.name || !email) return { ok: false as const, error: "Missing fields" };
    if (!looksLikeEmail(email)) return { ok: false as const, error: "Enter a valid email" };
    const rows = await sql.query<CoachRow>(`select * from coaches where slug = $1 and deleted_at is null limit 1`, [data.slug]);
    const coach = rows[0];
    if (!coach) return { ok: false as const, error: "Coach not found" };
    const bundle = await loadCoachBundle(sql, coach);
    const service = bundle.services.find((s) => s.id === data.serviceId) ?? bundle.services[0];
    if (!service) return { ok: false as const, error: "Coach is not set up" };
    const picked = pickLocation(bundle.activeLocations, data.locationId);
    if (!picked.ok) return { ok: false as const, error: picked.error };
    if (!bundle.open) return { ok: false as const, error: "This coach is not accepting new bookings" };
    const methods = enabledMethods(bool(coach.accept_card), bool(coach.accept_cash), coach.stripe_account_id);
    const method = data.method || (methods.includes("cash") ? "cash" : methods[0]);
    if (!method || !canUseMethod(method, bool(coach.accept_card), bool(coach.accept_cash), coach.stripe_account_id)) {
      return { ok: false as const, error: "That payment method is not available" };
    }
    const startAt = new Date(data.start);
    if (Number.isNaN(startAt.getTime())) return { ok: false as const, error: "That time is no longer open" };
    const tz = tzOf(coach.timezone);
    const dateKey = slotDateKey(data.start, tz);
    if (!isWithinBookAhead(dateKey, normalizeBookAheadDays(coach.book_ahead_days), todayKey(tz))) {
      return { ok: false as const, error: "That date is outside the booking window." };
    }
    const endAt = new Date(startAt.getTime() + service.duration * 60 * 1000);
    const lessonId = newId();
    if (method === "card" && (!getStripe() || !coach.stripe_account_id)) {
      return { ok: false as const, error: "Card checkout is not available" };
    }
    const holdUntil = holdExpiresAt();
    const written = await withTransaction(async (tx) => {
      await lockCoachSchedule(tx, coach.id);
      const slots = await openSlots(tx, coach.id, dateKey, service.duration);
      if (!slots.includes(startAt.toISOString())) return false;
      // Only this coach's CRM record: existing name/notes stay, phone fills if empty.
      const { id: clientId } = await findOrCreateCoachClient(tx, coach.id, {
        id: newId(),
        name: data.name.trim(),
        email,
        phone: data.phone,
      });
      if (method === "card") {
        await tx.query(
          `insert into lessons (id, coach_id, service_id, location_id, client_id, start_at, end_at, status, hold_until)
           values ($1,$2,$3,$4,$5,$6,$7,'held',$8)`,
          [lessonId, coach.id, service.id, picked.location.id, clientId, startAt.toISOString(), endAt.toISOString(), holdUntil.toISOString()],
        );
        await tx.query(
          `insert into payments (id, lesson_id, method, status, amount_cad) values ($1,$2,'card','unpaid',$3)`,
          [newId(), lessonId, service.price_cad],
        );
      } else {
        await tx.query(
          `insert into lessons (id, coach_id, service_id, location_id, client_id, start_at, end_at, status)
           values ($1,$2,$3,$4,$5,$6,$7,'confirmed')`,
          [lessonId, coach.id, service.id, picked.location.id, clientId, startAt.toISOString(), endAt.toISOString()],
        );
        await tx.query(
          `insert into payments (id, lesson_id, method, status, amount_cad) values ($1,$2,'cash','unpaid',$3)`,
          [newId(), lessonId, service.price_cad],
        );
      }
      return true;
    });
    if (!written) return { ok: false as const, error: "That time is no longer open" };
    if (method === "card") {
      const stripe = getStripe()!;
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "cad",
              unit_amount: service.price_cad * 100,
              product_data: { name: `${service.name} with ${coach.name}` },
            },
          },
        ],
        // Stripe requires at least 30 minutes. The slot hold is still 15 minutes;
        // a payment that lands after the hold lapsed is refunded by the webhook.
        expires_at: Math.floor(Math.max(holdUntil.getTime(), Date.now() + 31 * 60 * 1000) / 1000),
        metadata: { lessonId, kind: "lesson" },
        success_url: `${appUrl()}/confirmed?id=${lessonId}`,
        cancel_url: `${appUrl()}/${coach.slug}`,
        payment_intent_data: {
          application_fee_amount: Math.round(service.price_cad * 100 * 0.05),
          transfer_data: { destination: coach.stripe_account_id! },
        },
      });
      await sql.query(`update payments set stripe_checkout_session_id = $1 where lesson_id = $2`, [
        session.id,
        lessonId,
      ]);
      return { ok: true as const, id: lessonId, checkoutUrl: session.url };
    }
    await notifyLessonConfirmed(sql, lessonId);
    return { ok: true as const, id: lessonId };
  });

export const getBooking = createServerFn({ method: "GET" })
  .validator((input: { id: string }) => guardInput(input))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql.query<{
      id: string;
      start_at: string | Date;
      status: string;
      coach_name: string;
      coach_slug: string;
      timezone: string;
      service_name: string;
      duration: number;
      price_cad: number;
      location_name: string;
      client_name: string;
      client_email: string;
      pay_method: string | null;
      pay_status: string | null;
    }>(
      `select l.id, l.start_at, l.status, c.name as coach_name, c.slug as coach_slug, c.timezone,
              s.name as service_name, ${DURATION_SQL} as duration, s.price_cad, loc.name as location_name,
              cl.name as client_name, cl.email as client_email,
              p.method as pay_method, p.status as pay_status
       from lessons l
       join coaches c on c.id = l.coach_id
       join services s on s.id = l.service_id
       join locations loc on loc.id = l.location_id
       join clients cl on cl.id = l.client_id
       left join payments p on p.lesson_id = l.id
       where l.id = $1`,
      [data.id],
    );
    const row = rows[0];
    if (!row) return null;
    const start = asDate(row.start_at)!;
    const tz = tzOf(row.timezone);
    const payMethod = row.pay_method === "card" ? "card" : "cash";
    const payStatus = row.pay_status || (row.status === "held" ? "unpaid" : "unpaid");
    const payText =
      payMethod === "card"
        ? payStatus === "paid"
          ? "Paid by card"
          : "Pay by card"
        : "Pay in person";
    return {
      id: row.id,
      status: row.status,
      when: formatWhen(start, tz),
      time: formatTime(start, tz),
      start: start.toISOString(),
      timezone: tz,
      coachName: row.coach_name,
      coachSlug: row.coach_slug,
      serviceName: row.service_name,
      duration: row.duration,
      priceCad: row.price_cad,
      locationName: row.location_name,
      clientName: row.client_name,
      clientEmail: row.client_email,
      payMethod,
      payStatus,
      payText,
    };
  });

export const recordVisit = createServerFn({ method: "POST" })
  .validator((input: { visitorId?: string } = {}) => guardInput(input))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const id = data.visitorId && data.visitorId.length > 8 ? data.visitorId : newId();
    await sql.query(`insert into public_visitors (id) values ($1) on conflict (id) do update set seen_at = now()`, [id]);
    return { visitorId: id };
  });

/** Signed-in student's email (portal cookie), or null. */
async function studentEmail() {
  const { currentStudent } = await import("./student-session.server");
  const me = await currentStudent();
  return me ? normalizeEmail(me.email) : null;
}

export const studentLessons = createServerFn({ method: "GET" })
  .handler(async () => {
    const sql = await getSql();
    const email = await studentEmail();
    if (!email) return { ok: false as const, error: "Verify your email first" };
    const rows = await sql.query<{
      id: string;
      start_at: string | Date;
      status: string;
      coach_name: string;
      coach_slug: string;
      location_name: string;
      pay_status: string | null;
      pay_method: string | null;
      timezone: string;
      source: string;
      duration: number;
    }>(
      `select l.id, l.start_at, l.status, c.name as coach_name, c.slug as coach_slug, loc.name as location_name,
              p.status as pay_status, p.method as pay_method, c.timezone, l.source, ${DURATION_SQL} as duration
       from lessons l
       join coaches c on c.id = l.coach_id
       join locations loc on loc.id = l.location_id
       join services s on s.id = l.service_id
       join clients cl on cl.id = l.client_id
       left join payments p on p.lesson_id = l.id
       where lower(cl.email) = $1
       order by l.start_at desc`,
      [email],
    );
    return {
      ok: true as const,
      email,
      lessons: rows.map((r) => {
        const start = asDate(r.start_at)!;
        const pay = payLabel(r.pay_status, r.pay_method, { audience: "student" });
        const tz = tzOf(r.timezone);
        return {
          id: r.id,
          when: formatWhen(start, tz),
          timezone: tz,
          today: todayKey(tz),
          duration: Number(r.duration),
          recurring: r.source === "imported_recurring",
          start: start.toISOString(),
          status: lessonStatusLabel(r.status),
          rawStatus: r.status,
          coachName: r.coach_name,
          coachSlug: r.coach_slug,
          locationName: r.location_name,
          payText: pay.text,
          confirmed: r.status === "confirmed",
        };
      }),
    };
  });

export const studentChangeLesson = createServerFn({ method: "POST" })
  .validator((input: { lessonId: string; action: "cancel" | "reschedule"; start?: string }) => guardInput(input))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const email = await studentEmail();
    if (!email) return { ok: false as const, error: "Verify your email first" };
    const rows = await sql.query<{
      id: string;
      coach_id: string;
      status: string;
      start_at: string | Date;
      duration: number;
      coach_name: string;
      coach_email: string;
      book_ahead_days: number | string | null;
      client_name: string;
      client_email: string;
      pay_method: string | null;
      pay_status: string | null;
      pay_intent: string | null;
      timezone: string;
      source: string;
    }>(
      `select l.id, l.coach_id, l.status, l.start_at, ${DURATION_SQL} as duration, c.name as coach_name, c.email as coach_email,
              c.book_ahead_days, c.timezone, l.source, cl.name as client_name, cl.email as client_email, p.method as pay_method, p.status as pay_status,
              p.stripe_payment_intent_id as pay_intent
       from lessons l
       join services s on s.id = l.service_id
       join coaches c on c.id = l.coach_id
       join clients cl on cl.id = l.client_id
       left join payments p on p.lesson_id = l.id
       where l.id = $1`,
      [data.lessonId],
    );
    const lesson = rows[0];
    if (!lesson || normalizeEmail(lesson.client_email) !== email) {
      return { ok: false as const, error: "Lesson not found for that email" };
    }
    const startAt = asDate(lesson.start_at)!;
    const tz = tzOf(lesson.timezone);
    const selfServe = canSelfReschedule(startAt);
    const manageUrl = `${appUrl()}/manage?email=${encodeURIComponent(email)}`;
    if (data.action === "cancel") {
      if (!selfServe && lesson.pay_method === "card") {
        await sql.query(`update payments set status = 'no_refund' where lesson_id = $1`, [lesson.id]);
      } else if (lesson.pay_method === "card") {
        const stripe = getStripe();
        if (stripe && lesson.pay_intent && lesson.pay_status === "paid") {
          // Student cancels: refund the lesson fee; the coach's transfer is reversed,
          // the platform keeps its 5% application fee.
          await stripe.refunds.create({
            payment_intent: lesson.pay_intent,
            reverse_transfer: true,
            refund_application_fee: false,
          });
        }
        await sql.query(`update payments set status = 'refunded' where lesson_id = $1`, [lesson.id]);
      }
      await sql.query(`update lessons set status = 'cancelled' where id = $1`, [lesson.id]);
      for (const mail of changeMails({
        kind: "cancelled",
        coachName: lesson.coach_name,
        coachEmail: lesson.coach_email,
        studentName: lesson.client_name,
        studentEmail: lesson.client_email,
        when: formatWhen(startAt, tz),
        manageUrl,
      })) {
        await sendMail(mail);
      }
      pushLater(() =>
        pushToCoach(sql, lesson.coach_id, {
          title: "Lesson cancelled",
          body: `${lesson.client_name} cancelled ${formatWhen(startAt, tz)}`,
          path: `/app/lessons/${lesson.id}`,
        }),
      );
      return { ok: true as const };
    }
    if (lesson.source === "imported_recurring") {
      return { ok: false as const, error: "This is a regular weekly lesson. Ask your coach to change the time." };
    }
    if (!canMoveLesson(lesson.status)) return { ok: false as const, error: "That lesson cannot be moved" };
    if (!selfServe) {
      return { ok: false as const, error: "Within 24 hours, reschedule needs the coach. Email them or cancel." };
    }
    if (!data.start) return { ok: false as const, error: "Pick a new time" };
    const next = new Date(data.start);
    const dateKey = slotDateKey(data.start, tz);
    if (!isWithinBookAhead(dateKey, normalizeBookAheadDays(lesson.book_ahead_days), todayKey(tz))) {
      return { ok: false as const, error: "That date is outside the booking window." };
    }
    const endAt = new Date(next.getTime() + Number(lesson.duration) * 60 * 1000);
    const moved = await withTransaction(async (tx) => {
      await lockCoachSchedule(tx, lesson.coach_id);
      const slots = await openSlots(tx, lesson.coach_id, dateKey, Number(lesson.duration));
      if (!slots.includes(next.toISOString())) return false;
      await tx.query(
        `update lessons set start_at = $1, end_at = $2, status = $3, reminded_24h = false, reminded_2h = false where id = $4`,
        [next.toISOString(), endAt.toISOString(), statusAfterReschedule(lesson.status), lesson.id],
      );
      return true;
    });
    if (!moved) return { ok: false as const, error: "That time is not open" };
    for (const mail of changeMails({
      kind: "rescheduled",
      coachName: lesson.coach_name,
      coachEmail: lesson.coach_email,
      studentName: lesson.client_name,
      studentEmail: lesson.client_email,
      when: formatWhen(startAt, tz),
      nextWhen: formatWhen(next, tz),
      manageUrl,
    })) {
      await sendMail(mail);
    }
    return { ok: true as const };
  });

type RequestRow = {
  id: string;
  coach_id: string;
  kind: string;
  status: string;
  lesson_id: string;
  other_lesson_id: string | null;
  proposed_start: string | Date | null;
  note: string;
  created_by: string;
  student_token: string | null;
  other_token: string | null;
  student_decision: string;
  other_decision: string | null;
  created_at: string | Date;
};

type LessonParty = {
  id: string;
  coach_id: string;
  status: string;
  start_at: string | Date;
  end_at: string | Date;
  duration: number;
  location_id: string;
  client_id: string;
  client_name: string;
  client_email: string;
  coach_name: string;
  coach_email: string;
  book_ahead_days?: number | string | null;
  timezone: string;
  source: string;
};

async function lessonParty(sql: Pick<Sql, "query">, lessonId: string) {
  const rows = await sql.query<LessonParty>(
    `select l.id, l.coach_id, l.status, l.start_at, l.end_at, ${DURATION_SQL} as duration, l.location_id,
            cl.id as client_id, cl.name as client_name, cl.email as client_email,
            c.name as coach_name, c.email as coach_email, c.book_ahead_days, c.timezone, l.source
     from lessons l
     join services s on s.id = l.service_id
     join clients cl on cl.id = l.client_id
     join coaches c on c.id = l.coach_id
     where l.id = $1`,
    [lessonId],
  );
  return rows[0] ?? null;
}

async function pendingOnLesson(sql: Sql, lessonId: string, coachId: string) {
  const rows = await sql.query<{ id: string }>(
    `select id from booking_requests
     where coach_id = $1 and status = 'pending' and (lesson_id = $2 or other_lesson_id = $2)
     limit 1`,
    [coachId, lessonId],
  );
  return rows[0] ?? null;
}

function inboxUrl() {
  return `${appUrl()}/app/bookings?tab=requests`;
}

async function applyLessonMove(sql: Pick<Sql, "query">, lesson: LessonParty, next: Date) {
  const endAt = new Date(next.getTime() + Number(lesson.duration) * 60 * 1000);
  await sql.query(
    `update lessons set start_at = $1, end_at = $2, status = $3, reminded_24h = false, reminded_2h = false where id = $4`,
    [next.toISOString(), endAt.toISOString(), statusAfterReschedule(lesson.status), lesson.id],
  );
}

async function applyLessonSwap(sql: Pick<Sql, "query">, a: LessonParty, b: LessonParty) {
  const plan = swapPlan(
    { duration: a.duration, start: asDate(a.start_at)! },
    { duration: b.duration, start: asDate(b.start_at)! },
  );
  if (!plan.ok) return plan;
  const aLoc = a.location_id;
  const bLoc = b.location_id;
  await sql.query(
    `update lessons set start_at = $1, end_at = $2, location_id = $3, reminded_24h = false, reminded_2h = false where id = $4`,
    [asDate(b.start_at)!.toISOString(), plan.aEnd.toISOString(), bLoc, a.id],
  );
  await sql.query(
    `update lessons set start_at = $1, end_at = $2, location_id = $3, reminded_24h = false, reminded_2h = false where id = $4`,
    [asDate(a.start_at)!.toISOString(), plan.bEnd.toISOString(), aLoc, b.id],
  );
  return { ok: true as const };
}

export const studentRequestMove = createServerFn({ method: "POST" })
  .validator((input: { lessonId: string; start: string; note?: string }) => guardInput(input))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const email = await studentEmail();
    if (!email) return { ok: false as const, error: "Verify your email first" };
    const lesson = await lessonParty(sql, data.lessonId);
    if (!lesson || normalizeEmail(lesson.client_email) !== email) {
      return { ok: false as const, error: "Lesson not found for that email" };
    }
    if (!canMoveLesson(lesson.status)) return { ok: false as const, error: "That lesson cannot be moved" };
    if (await pendingOnLesson(sql, lesson.id, lesson.coach_id)) {
      return { ok: false as const, error: "You already have a request waiting on this lesson." };
    }
    const next = new Date(data.start);
    const tz = tzOf(lesson.timezone);
    const dateKey = slotDateKey(data.start, tz);
    if (!isWithinBookAhead(dateKey, normalizeBookAheadDays(lesson.book_ahead_days), todayKey(tz))) {
      return { ok: false as const, error: "That date is outside the booking window." };
    }
    const slots = await openSlots(sql, lesson.coach_id, dateKey, Number(lesson.duration));
    if (!slots.includes(next.toISOString())) return { ok: false as const, error: "That time is not open" };
    const note = clipNote(data.note || "Please move this lesson.");
    const id = newId();
    await sql.query(
      `insert into booking_requests
        (id, coach_id, kind, status, lesson_id, proposed_start, note, created_by, student_decision)
       values ($1,$2,'student_move','pending',$3,$4,$5,'student','accepted')`,
      [id, lesson.coach_id, lesson.id, next.toISOString(), note],
    );
    const manageUrl = `${appUrl()}/manage?email=${encodeURIComponent(email)}`;
    for (const mail of studentMoveRequestMails({
      coachName: lesson.coach_name,
      coachEmail: lesson.coach_email,
      studentName: lesson.client_name,
      studentEmail: lesson.client_email,
      when: formatWhen(asDate(lesson.start_at)!, tz),
      nextWhen: formatWhen(next, tz),
      note,
      inboxUrl: inboxUrl(),
      manageUrl,
    })) {
      await sendMail(mail);
    }
    {
      const coachId = lesson.coach_id;
      const body = `${lesson.client_name} asked to move ${formatWhen(asDate(lesson.start_at)!, tz)}`;
      pushLater(() => pushToCoach(sql, coachId, { title: "Move request", body, path: "/app/bookings?tab=requests" }));
    }
    return { ok: true as const, id };
  });

export const studentListRequests = createServerFn({ method: "GET" })
  .handler(async () => {
    const sql = await getSql();
    const email = await studentEmail();
    if (!email) return { ok: false as const, error: "Verify your email first" };
    const rows = await sql.query<
      RequestRow & {
        start_at: string | Date;
        other_start?: string | Date | null;
        coach_name: string;
        student_email: string;
        other_email?: string | null;
        timezone: string;
      }
    >(
      `select r.id, r.kind, r.status, r.note, r.proposed_start, r.student_token, r.other_token,
              r.student_decision, r.other_decision, r.lesson_id, r.other_lesson_id,
              l.start_at, o.start_at as other_start, c.name as coach_name, c.timezone,
              lower(cl.email) as student_email, lower(ocl.email) as other_email
       from booking_requests r
       join lessons l on l.id = r.lesson_id
       join coaches c on c.id = r.coach_id
       join clients cl on cl.id = l.client_id
       left join lessons o on o.id = r.other_lesson_id
       left join clients ocl on ocl.id = o.client_id
       where lower(cl.email) = $1 or lower(ocl.email) = $1
       order by r.created_at desc
       limit 20`,
      [email],
    );
    return {
      ok: true as const,
      requests: rows.map((r) => {
        const tz = tzOf(r.timezone);
        const view = viewerRequestView({
          viewerEmail: email,
          primaryEmail: r.student_email,
          primaryWhen: formatWhen(asDate(r.start_at)!, tz),
          primaryLessonId: r.lesson_id,
          otherEmail: r.other_email,
          otherWhen: r.other_start ? formatWhen(asDate(r.other_start)!, tz) : null,
          otherLessonId: r.other_lesson_id,
          kind: r.kind,
          status: r.status,
          studentDecision: r.student_decision,
          otherDecision: r.other_decision,
          studentToken: r.student_token,
          otherToken: r.other_token,
        });
        return {
          id: r.id,
          kind: r.kind,
          status: r.status,
          when: view.yourWhen,
          otherWhen: view.otherWhen,
          nextWhen: r.proposed_start ? formatWhen(asDate(r.proposed_start)!, tz) : null,
          note: r.note,
          coachName: r.coach_name,
          otherLabel: view.otherLabel,
          lessonId: view.lessonId,
          token: view.token,
          decision: view.decision,
          canDecide: view.canDecide,
        };
      }),
    };
  });

export const getRequestByToken = createServerFn({ method: "GET" })
  .validator((input: { token: string }) => guardInput(input))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const token = String(data.token || "").trim();
    if (token.length < 16) return { ok: false as const, error: "That link is invalid." };
    const rows = await sql.query<RequestRow>(
      `select * from booking_requests where student_token = $1 or other_token = $1 limit 1`,
      [token],
    );
    const row = rows[0];
    if (!row) return { ok: false as const, error: "That link is invalid or already used." };
    const mine = await lessonParty(sql, row.student_token === token ? row.lesson_id : row.other_lesson_id || row.lesson_id);
    const other = row.other_lesson_id ? await lessonParty(sql, row.student_token === token ? row.other_lesson_id : row.lesson_id) : null;
    if (!mine) return { ok: false as const, error: "Lesson not found." };
    const side = row.student_token === token ? "student" : "other";
    const decision = side === "student" ? row.student_decision : row.other_decision || "pending";
    return {
      ok: true as const,
      request: {
        id: row.id,
        kind: row.kind,
        status: row.status,
        coachName: mine.coach_name,
        yourName: firstName(mine.client_name),
        yourWhen: formatWhen(asDate(mine.start_at)!, tzOf(mine.timezone)),
        otherLabel: other ? ANOTHER_STUDENT : null,
        otherWhen: other ? formatWhen(asDate(other.start_at)!, tzOf(mine.timezone)) : null,
        note: row.note,
        decision,
        pending: isOpenRequest(row.status) && decision === "pending",
      },
    };
  });

export const decideRequest = createServerFn({ method: "POST" })
  .validator((input: { token: string; decision: "accepted" | "declined" }) => guardInput(input))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const token = String(data.token || "").trim();
    if (data.decision !== "accepted" && data.decision !== "declined") {
      return { ok: false as const, error: "Choose accept or decline." };
    }
    const rows = await sql.query<RequestRow>(
      `select * from booking_requests where student_token = $1 or other_token = $1 limit 1`,
      [token],
    );
    const row = rows[0];
    if (!row || !isOpenRequest(row.status)) return { ok: false as const, error: "This request is no longer open." };
    const side = row.student_token === token ? "student" : "other";
    const studentDecision = (side === "student" ? data.decision : row.student_decision) as "pending" | "accepted" | "declined";
    const otherDecision = (side === "other" ? data.decision : row.other_decision || "pending") as
      | "pending"
      | "accepted"
      | "declined";
    const nextStatus = afterPartyDecision(studentDecision, otherDecision);
    await sql.query(
      `update booking_requests set student_decision = $1, other_decision = $2, status = $3, resolved_at = $4 where id = $5`,
      [
        studentDecision,
        otherDecision,
        nextStatus,
        nextStatus === "pending" ? null : new Date().toISOString(),
        row.id,
      ],
    );
    const a = await lessonParty(sql, row.lesson_id);
    const b = row.other_lesson_id ? await lessonParty(sql, row.other_lesson_id) : null;
    if (nextStatus === "accepted" && a && b) {
      const applied = await withTransaction(async (tx) => {
        await lockCoachSchedule(tx, a.coach_id);
        const la = await lessonParty(tx, a.id);
        const lb = await lessonParty(tx, b.id);
        const usable = (l: LessonParty | null) => l && canMoveLesson(l.status) && l.source !== "imported_recurring";
        if (!usable(la) || !usable(lb)) {
          return { ok: false as const, error: "One of these lessons changed, so the swap was not applied." };
        }
        return applyLessonSwap(tx, la!, lb!);
      });
      if (!applied.ok) {
        await sql.query(`update booking_requests set status = 'pending', resolved_at = null where id = $1`, [row.id]);
        return { ok: false as const, error: applied.error };
      }
      const aWhen = formatWhen(asDate(a.start_at)!, tzOf(a.timezone));
      const bWhen = formatWhen(asDate(b.start_at)!, tzOf(a.timezone));
      await sendMail(
        requestResolvedMail({
          studentEmail: a.client_email,
          studentName: a.client_name,
          coachName: a.coach_name,
          kind: "accepted",
          summary: `Your lesson moved from ${aWhen} to ${bWhen}.`,
          manageUrl: `${appUrl()}/manage?email=${encodeURIComponent(a.client_email)}`,
        }),
      );
      await sendMail(
        requestResolvedMail({
          studentEmail: b.client_email,
          studentName: b.client_name,
          coachName: b.coach_name,
          kind: "accepted",
          summary: `Your lesson moved from ${bWhen} to ${aWhen}.`,
          manageUrl: `${appUrl()}/manage?email=${encodeURIComponent(b.client_email)}`,
        }),
      );
      return { ok: true as const, status: nextStatus, message: "Swap confirmed. Both lessons moved." };
    }
    if (nextStatus === "declined" && a) {
      await sendMail(
        requestResolvedMail({
          studentEmail: a.client_email,
          studentName: a.client_name,
          coachName: a.coach_name,
          kind: "declined",
          summary: "The proposed time swap did not go through. Your lesson stays as booked.",
        }),
      );
      if (b) {
        await sendMail(
          requestResolvedMail({
            studentEmail: b.client_email,
            studentName: b.client_name,
            coachName: b.coach_name,
            kind: "declined",
            summary: "The proposed time swap did not go through. Your lesson stays as booked.",
          }),
        );
      }
      return { ok: true as const, status: nextStatus, message: "Declined. Nothing changed." };
    }
    return { ok: true as const, status: nextStatus, message: "Got it. Waiting on the other student." };
  });

export const listCoachRequests = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const coach = await coachForUser(sql, context.userId);
    if (!coach) return { ok: false as const, error: "Sign in required" };
    const rows = await sql.query<
      RequestRow & {
        client_name: string;
        start_at: string | Date;
        other_name: string | null;
        other_start: string | Date | null;
      }
    >(
      `select r.*, cl.name as client_name, l.start_at, ocl.name as other_name, o.start_at as other_start
       from booking_requests r
       join lessons l on l.id = r.lesson_id
       join clients cl on cl.id = l.client_id
       left join lessons o on o.id = r.other_lesson_id
       left join clients ocl on ocl.id = o.client_id
       where r.coach_id = $1
       order by case when r.status = 'pending' then 0 else 1 end, r.created_at desc
       limit 40`,
      [coach.id],
    );
    return {
      ok: true as const,
      pending: rows.filter((r) => r.status === "pending").length,
      requests: rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        status: r.status,
        note: r.note,
        createdBy: r.created_by,
        studentName: r.client_name,
        studentWhen: formatWhen(asDate(r.start_at)!, tzOf(coach.timezone)),
        otherName: r.other_name,
        otherWhen: r.other_start ? formatWhen(asDate(r.other_start)!, tzOf(coach.timezone)) : null,
        nextWhen: r.proposed_start ? formatWhen(asDate(r.proposed_start)!, tzOf(coach.timezone)) : null,
        studentDecision: r.student_decision,
        otherDecision: r.other_decision,
      })),
    };
  });

export const coachDecideMoveRequest = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { requestId: string; decision: "accepted" | "declined" }) => guardInput(input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const coach = await coachForUser(sql, context.userId);
    if (!coach) return { ok: false as const, error: "Sign in required" };
    const rows = await sql.query<RequestRow>(
      `select * from booking_requests where id = $1 and coach_id = $2`,
      [data.requestId, coach.id],
    );
    const row = rows[0];
    if (!row || row.kind !== "student_move" || !isOpenRequest(row.status)) {
      return { ok: false as const, error: "That request is not waiting on you." };
    }
    const lesson = await lessonParty(sql, row.lesson_id);
    if (!lesson) return { ok: false as const, error: "Lesson not found" };
    if (data.decision === "declined") {
      await sql.query(`update booking_requests set status = 'declined', resolved_at = now() where id = $1`, [row.id]);
      await sendMail(
        requestResolvedMail({
          studentEmail: lesson.client_email,
          studentName: lesson.client_name,
          coachName: coach.name,
          kind: "declined",
          summary: `${coach.name} kept your lesson at ${formatWhen(asDate(lesson.start_at)!, tzOf(coach.timezone))}.`,
          manageUrl: `${appUrl()}/manage?email=${encodeURIComponent(lesson.client_email)}`,
        }),
      );
      return { ok: true as const, message: "Declined. Lesson stays." };
    }
    if (!row.proposed_start) return { ok: false as const, error: "No new time on that request." };
    const next = asDate(row.proposed_start)!;
    const tz = tzOf(coach.timezone);
    const fromWhen = formatWhen(asDate(lesson.start_at)!, tz);
    const moved = await withTransaction(async (tx) => {
      await lockCoachSchedule(tx, coach.id);
      const current = await lessonParty(tx, lesson.id);
      if (!current || !canMoveLesson(current.status)) return "gone" as const;
      const slots = await openSlots(tx, coach.id, slotDateKey(next.toISOString(), tz), Number(current.duration));
      if (!slots.includes(next.toISOString())) return "taken" as const;
      await applyLessonMove(tx, current, next);
      await tx.query(`update booking_requests set status = 'accepted', resolved_at = now() where id = $1`, [row.id]);
      return "ok" as const;
    });
    if (moved === "gone") return { ok: false as const, error: "That lesson can no longer be moved." };
    if (moved === "taken") return { ok: false as const, error: "That time is no longer open." };
    await sendMail(
      requestResolvedMail({
        studentEmail: lesson.client_email,
        studentName: lesson.client_name,
        coachName: coach.name,
        kind: "accepted",
        summary: `Your lesson moved from ${fromWhen} to ${formatWhen(next, tz)}.`,
        manageUrl: `${appUrl()}/manage?email=${encodeURIComponent(lesson.client_email)}`,
      }),
    );
    return { ok: true as const, message: "Moved. The student was emailed." };
  });

export const coachProposeSwap = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { lessonAId: string; lessonBId: string; note?: string }) => guardInput(input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const coach = await coachForUser(sql, context.userId);
    if (!coach) return { ok: false as const, error: "Sign in required" };
    return createCoachSwap(sql, coach, data.lessonAId, data.lessonBId, data.note || "");
  });

async function createCoachSwap(
  sql: Sql,
  coach: CoachRow,
  lessonAId: string,
  lessonBId: string,
  rawNote: string,
) {
  if (lessonAId === lessonBId) return { ok: false as const, error: "Pick two different lessons." };
  const a = await lessonParty(sql, lessonAId);
  const b = await lessonParty(sql, lessonBId);
  if (!a || !b || a.coach_id !== coach.id || b.coach_id !== coach.id) {
    return { ok: false as const, error: "Both lessons need to be yours." };
  }
  if (!canMoveLesson(a.status) || !canMoveLesson(b.status)) {
    return { ok: false as const, error: "Both lessons need to be upcoming." };
  }
  if (a.source === "imported_recurring" || b.source === "imported_recurring") {
    return { ok: false as const, error: "Regular weekly lessons can't be swapped." };
  }
  const plan = swapPlan(
    { duration: a.duration, start: asDate(a.start_at)! },
    { duration: b.duration, start: asDate(b.start_at)! },
  );
  if (!plan.ok) return plan;
  if (await pendingOnLesson(sql, a.id, coach.id)) return { ok: false as const, error: `${firstName(a.client_name)} already has a pending request. Please choose a different student.` };
  if (await pendingOnLesson(sql, b.id, coach.id)) return { ok: false as const, error: `${firstName(b.client_name)} already has a pending request. Please choose a different student.` };
  const note = clipNote(rawNote || "Please swap these two lesson times.");
  const id = newId();
  const studentToken = makeToken();
  const otherToken = makeToken();
  await sql.query(
    `insert into booking_requests
      (id, coach_id, kind, status, lesson_id, other_lesson_id, note, created_by, student_token, other_token, student_decision, other_decision)
     values ($1,$2,'coach_swap','pending',$3,$4,$5,'coach',$6,$7,'pending','pending')`,
    [id, coach.id, a.id, b.id, note, studentToken, otherToken],
  );
  const aWhen = formatWhen(asDate(a.start_at)!, tzOf(coach.timezone));
  const bWhen = formatWhen(asDate(b.start_at)!, tzOf(coach.timezone));
  await sendMail(
    coachSwapRequestMail({
      studentEmail: a.client_email,
      studentName: a.client_name,
      coachName: coach.name,
      yourWhen: aWhen,
      otherWhen: bWhen,
      note,
      decideUrl: `${appUrl()}/r/${studentToken}`,
    }),
  );
  await sendMail(
    coachSwapRequestMail({
      studentEmail: b.client_email,
      studentName: b.client_name,
      coachName: coach.name,
      yourWhen: bWhen,
      otherWhen: aWhen,
      note,
      decideUrl: `${appUrl()}/r/${otherToken}`,
    }),
  );
  return {
    ok: true as const,
    id,
    message: `Sent to ${firstName(a.client_name)} and ${firstName(b.client_name)}. Nothing changes until both accept.`,
  };
}

export const coachWithdrawRequest = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { requestId: string }) => guardInput(input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const coach = await coachForUser(sql, context.userId);
    if (!coach) return { ok: false as const, error: "Sign in required" };
    const rows = await sql.query<RequestRow>(
      `select * from booking_requests where id = $1 and coach_id = $2`,
      [data.requestId, coach.id],
    );
    const row = rows[0];
    if (!row || row.kind !== "coach_swap" || !isOpenRequest(row.status)) {
      return { ok: false as const, error: "That swap is not open to withdraw." };
    }
    await sql.query(`update booking_requests set status = 'cancelled', resolved_at = now() where id = $1`, [row.id]);
    const a = await lessonParty(sql, row.lesson_id);
    const b = row.other_lesson_id ? await lessonParty(sql, row.other_lesson_id) : null;
    const summary = `${coach.name} withdrew the proposed time swap. Your lesson stays as booked.`;
    if (a) {
      await sendMail(
        requestResolvedMail({
          studentEmail: a.client_email,
          studentName: a.client_name,
          coachName: coach.name,
          kind: "withdrawn",
          summary,
          manageUrl: `${appUrl()}/manage?email=${encodeURIComponent(a.client_email)}`,
        }),
      );
    }
    if (b) {
      await sendMail(
        requestResolvedMail({
          studentEmail: b.client_email,
          studentName: b.client_name,
          coachName: coach.name,
          kind: "withdrawn",
          summary,
          manageUrl: `${appUrl()}/manage?email=${encodeURIComponent(b.client_email)}`,
        }),
      );
    }
    return { ok: true as const, message: "Swap withdrawn. Both students were emailed." };
  });

async function uniqueSlug(sql: Sql, base: string) {
  let slug = slugifyName(base);
  if (isReservedSlug(slug)) slug = `${slug}-coach`;
  for (let i = 0; i < 8; i++) {
    const rows = await sql.query<{ id: string }>(`select id from coaches where slug = $1`, [slug]);
    if (!rows[0] && !isReservedSlug(slug)) return slug;
    slug = `${slugifyName(base)}-${Math.random().toString(36).slice(2, 6)}`;
  }
  return `${slugifyName(base)}-${newId().slice(0, 6)}`;
}

export async function coachForUser(sql: Pick<Sql, "query">, userId: string) {
  const rows = await sql.query<CoachRow>(`select * from coaches where user_id = $1 and deleted_at is null limit 1`, [userId]);
  return rows[0] ?? null;
}

export type MyCoach = {
  id: string;
  slug: string;
  name: string;
  title: string;
  sport: string;
  city: string;
  timezone: string;
  languages: string;
  email: string;
  photoUrl: string | null;
  banned: boolean;
  setup: boolean;
  open: boolean;
  plan: string;
  status: string;
  trialEndsAt: string | null;
  accessGrant: string;
  acceptCash: boolean;
  acceptCard: boolean;
  stripeConnected: boolean;
  stripeConfigured: boolean;
  /** True when Apple Pass signing certs are set (Vercel env). */
  walletEnabled: boolean;
  capabilities: string[];
  pendingRequests: number;
  services: { id: string; name: string; duration: number; priceCad: number }[];
  locations: {
    id: string;
    name: string;
    address: string;
    kind: string;
    active: boolean;
    placeId?: string | null;
    lat?: number | null;
    lng?: number | null;
    verified?: boolean;
  }[];
  hours: HourSegment[];
  bookAheadDays: number;
  assistantName: string;
  unreadMessages: number;
};

function toMyCoach(
  coach: CoachRow,
  bundle: Awaited<ReturnType<typeof loadCoachBundle>>,
  pendingRequests = 0,
  unreadMessages = 0,
): MyCoach {
  return {
    id: coach.id,
    slug: coach.slug,
    name: coach.name,
    title: coach.title,
    sport: coach.sport || sportFromTitle(coach.title),
    city: coach.city,
    timezone: coach.timezone,
    languages: coach.languages,
    email: coach.email,
    photoUrl: coach.photo_url,
    banned: bool(coach.banned),
    setup: bundle.setup,
    open: bundle.open,
    plan: coach.plan,
    status: coach.subscription_status,
    trialEndsAt: coach.trial_ends_at ? asDate(coach.trial_ends_at)!.toISOString() : null,
    accessGrant: coach.access_grant,
    acceptCash: bool(coach.accept_cash),
    acceptCard: bool(coach.accept_card),
    stripeConnected: Boolean(coach.stripe_account_id),
    stripeConfigured: stripeConfigured(),
    walletEnabled: appleWalletSigningConfigured(),
    capabilities: planCapabilities(coach.plan, coach.subscription_status, asDate(coach.trial_ends_at)),
    pendingRequests,
    services: bundle.services.map((s) => ({
      id: s.id,
      name: s.name,
      duration: s.duration,
      priceCad: s.price_cad,
    })),
    locations: bundle.locations.map((l) => ({
      id: l.id,
      name: l.name,
      address: l.address,
      kind: l.kind,
      active: bool(l.active),
      placeId: l.place_id,
      lat: l.lat,
      lng: l.lng,
      verified: bool(l.verified),
    })),
    hours: bundle.hours.map((h) => ({ weekday: h.weekday, startMin: h.start_min, endMin: h.end_min })),
    bookAheadDays: normalizeBookAheadDays(coach.book_ahead_days),
    assistantName: normalizeAssistantName(coach.assistant_name),
    unreadMessages,
  };
}

export const getMyCoach = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const user = await authUser(sql, context.userId);
    if (!user) return { ok: false as const, error: "Sign in required" };
    let coach = await coachForUser(sql, context.userId);
    if (!coach) {
      const slug = await uniqueSlug(sql, user.name || user.email.split("@")[0] || "coach");
      const id = newId();
      await sql.query(
        `insert into coaches (id, user_id, slug, name, email, city, timezone, languages, title, sport, subscription_status, plan)
         values ($1,$2,$3,$4,$5,'',$6,'English','','tennis','none','none')`,
        [id, context.userId, slug, user.name || "Coach", user.email, DEFAULT_TIMEZONE],
      );
      coach = (await coachForUser(sql, context.userId))!;
    }
    if (bool(coach.banned)) return { ok: false as const, error: "This account is closed", banned: true as const };
    coach = await expireStaleTrial(sql, coach);
    const bundle = await loadCoachBundle(sql, coach);
    const pending = await sql.query<{ n: number }>(
      `select count(*)::int as n from booking_requests where coach_id = $1 and status = 'pending'`,
      [coach.id],
    );
    const unread = await coachUnreadCount(sql, coach.id);
    return { ok: true as const, coach: toMyCoach(coach, bundle, pending[0]?.n || 0, unread) };
  });

async function seedDemoBookings(sql: Sql, coachId: string) {
  const service = (await sql.query<{ id: string; price_cad: number }>(`select id, price_cad from services where coach_id = $1 limit 1`, [coachId]))[0];
  const location = (await sql.query<{ id: string }>(`select id from locations where coach_id = $1 and active = true limit 1`, [coachId]))[0];
  if (!service || !location) return;
  const tz = await coachTimezone(sql, coachId);
  const today = todayKey(tz);
  const weekdays = [1, 2, 3];
  const startMins = [600, 960, 1020];
  let samLessonId: string | null = null;
  for (let i = 0; i < DEMO_STUDENTS.length; i++) {
    const student = DEMO_STUDENTS[i];
    const email = normalizeEmail(student.email);
    const client = await findOrCreateCoachClient(sql, coachId, { id: newId(), name: student.name, email });
    const existingLesson = (
      await sql.query<{ id: string }>(
        `select id from lessons where coach_id = $1 and client_id = $2 and status = 'confirmed' order by start_at asc limit 1`,
        [coachId, client.id],
      )
    )[0];
    let lessonId = existingLesson?.id || null;
    if (!lessonId) {
      let day = nextWeekdayKey(today, weekdays[i] ?? 1);
      let start = zonedInstant(day, startMins[i] ?? 600, tz);
      if (start.getTime() <= Date.now()) {
        day = shiftDateKey(day, 7);
        start = zonedInstant(day, startMins[i] ?? 600, tz);
      }
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      lessonId = newId();
      await sql.query(
        `insert into lessons (id, coach_id, service_id, location_id, client_id, start_at, end_at, status)
         values ($1,$2,$3,$4,$5,$6,$7,'confirmed')`,
        [lessonId, coachId, service.id, location.id, client.id, start.toISOString(), end.toISOString()],
      );
      await sql.query(`insert into payments (id, lesson_id, method, status, amount_cad) values ($1,$2,'cash','unpaid',$3)`, [
        newId(),
        lessonId,
        service.price_cad,
      ]);
    }
    if (student.email === "sam@bookme.test") samLessonId = lessonId;
  }
  if (!samLessonId) return;
  const open = (
    await sql.query<{ id: string }>(`select id from booking_requests where coach_id = $1 and status = 'pending' limit 1`, [coachId])
  )[0];
  if (open) return;
  const lesson = await lessonParty(sql, samLessonId);
  if (!lesson) return;
  let thu = nextWeekdayKey(today, 4);
  let next = zonedInstant(thu, 1020, tz);
  if (next.getTime() <= Date.now() || next.getTime() === asDate(lesson.start_at)!.getTime()) {
    thu = shiftDateKey(thu, 7);
    next = zonedInstant(thu, 1020, tz);
  }
  await sql.query(
    `insert into booking_requests
      (id, coach_id, kind, status, lesson_id, proposed_start, note, created_by, student_decision)
     values ($1,$2,'student_move','pending',$3,$4,$5,'student','accepted')`,
    [newId(), coachId, lesson.id, next.toISOString(), "School concert that afternoon — can we move?"],
  );
}

async function polishDemoCoach(sql: Sql, coachId: string) {
  const taken = await sql.query<{ id: string }>(
    `select id from coaches where slug = $1 and id <> $2`,
    [DEMO_COACH.slug, coachId],
  );
  const slug = taken[0] ? undefined : DEMO_COACH.slug;
  if (slug) {
    await sql.query(
      `update coaches
         set slug = $1, photo_url = $2, headline = $3, bio = $4, title = $5, sport = 'tennis', city = 'Markham, ON'
       where id = $6`,
      [slug, DEMO_COACH.photoUrl, DEMO_COACH.headline, DEMO_COACH.bio, DEMO_COACH.title, coachId],
    );
  } else {
    await sql.query(
      `update coaches
         set photo_url = $1, headline = $2, bio = $3, title = $4, sport = 'tennis', city = 'Markham, ON'
       where id = $5`,
      [DEMO_COACH.photoUrl, DEMO_COACH.headline, DEMO_COACH.bio, DEMO_COACH.title, coachId],
    );
  }
  await sql.query(`update services set price_cad = $1 where coach_id = $2`, [DEMO_COACH.priceCad, coachId]);
}

function demoAllowed() {
  return process.env.NODE_ENV !== "production" || process.env.BOOKME_ALLOW_DEMO === "1";
}

async function ensureDemoReady(sql: Sql) {
  if (!demoAllowed()) return;
  const email = DEMO_COACH.email;
  let user = (await sql.query<{ id: string }>(`select id from "user" where email = $1`, [email]))[0];
  if (!user) {
    const { hashPassword } = await import("better-auth/crypto");
    const password = await hashPassword(DEMO_COACH.password);
    const id = newId();
    const now = new Date().toISOString();
    await sql.query(
      `insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt") values ($1,$2,$3,true,$4,$5)`,
      [id, DEMO_COACH.name, email, now, now],
    );
    await sql.query(
      `insert into "account" (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
       values ($1,$2,'credential',$3,$4,$5,$6)`,
      [newId(), id, id, password, now, now],
    );
    user = { id };
  }
  const existing = await sql.query<{ id: string }>(`select id from coaches where user_id = $1 limit 1`, [user.id]);
  if (existing[0]) {
    await polishDemoCoach(sql, existing[0].id);
    await seedDemoBookings(sql, existing[0].id);
    return { ok: true as const, slug: DEMO_COACH.slug };
  }
  const taken = await sql.query<{ id: string }>(`select id from coaches where slug = $1`, [DEMO_COACH.slug]);
  const slug = taken[0] ? await uniqueSlug(sql, DEMO_COACH.name) : DEMO_COACH.slug;
  const coachId = newId();
  const trialEnds = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await sql.query(
    `insert into coaches (
       id, user_id, slug, name, email, title, sport, city, timezone, languages, headline, bio, photo_url,
       subscription_status, plan, trial_ends_at, accept_card, accept_cash
     ) values ($1,$2,$3,$4,$5,$6,'tennis','Markham, ON',$11,'English',
       $7,$8,$9,'trialing','light',$10,false,true)`,
    [
      coachId,
      user.id,
      slug,
      DEMO_COACH.name,
      email,
      DEMO_COACH.title,
      DEMO_COACH.headline,
      DEMO_COACH.bio,
      DEMO_COACH.photoUrl,
      trialEnds,
      DEFAULT_TIMEZONE,
    ],
  );
  await sql.query(`insert into services (id, coach_id, name, duration, price_cad) values ($1,$2,$3,60,$4)`, [
    newId(),
    coachId,
    "Private tennis",
    DEMO_COACH.priceCad,
  ]);
  await sql.query(
    `insert into locations (id, coach_id, name, address, kind, active) values ($1,$2,$3,$4,'in_person',true)`,
    [newId(), coachId, "Mayfair Parkway", "50 Steelcase Rd, Markham"],
  );
  for (const day of [1, 2, 3, 4, 5]) {
    await sql.query(
      `insert into weekly_hours (id, coach_id, weekday, start_min, end_min) values ($1,$2,$3,600,1200)`,
      [newId(), coachId, day],
    );
  }
  await seedDemoBookings(sql, coachId);
  return { ok: true as const, slug: DEMO_COACH.slug };
}

export const ensureDemoCoach = createServerFn({ method: "POST" }).handler(async () => {
  if (!demoAllowed()) return;
  const sql = await getSql();
  return ensureDemoReady(sql);
});

export const saveCoachBasics = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { name: string; title: string; duration: number; priceCad: number; timezone?: string; languages?: string }) => guardInput(input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const coach = await coachForUser(sql, context.userId);
    if (!coach) return { ok: false as const, error: "Sign in required" };
    if (!data.title.trim()) return { ok: false as const, error: "Pick a vertical" };
    if (!isLessonDuration(data.duration)) return { ok: false as const, error: `Duration must be ${LESSON_DURATIONS.join(", ")} minutes` };
    if (!(data.priceCad > 0)) return { ok: false as const, error: "Price is required" };
    const timezone = data.timezone && isValidTimezone(data.timezone) ? data.timezone : tzOf(coach.timezone);
    const sport = sportFromTitle(data.title);
    await sql.query(
      `update coaches set name = $1, title = $2, sport = $3, timezone = $4, languages = $5 where id = $6 and user_id = $7`,
      [
        data.name.trim() || coach.name,
        data.title.trim(),
        sport,
        timezone,
        data.languages || coach.languages || "English",
        coach.id,
        context.userId,
      ],
    );
    const existing = await sql.query<{ id: string }>(`select id from services where coach_id = $1 order by name limit 1`, [coach.id]);
    const serviceName = `Private ${data.title.replace(/coach/i, "").trim().toLowerCase() || sport}`;
    if (existing[0]) {
      await sql.query(`update services set name = $1, duration = $2, price_cad = $3 where id = $4`, [
        serviceName,
        data.duration,
        data.priceCad,
        existing[0].id,
      ]);
    } else {
      await sql.query(`insert into services (id, coach_id, name, duration, price_cad) values ($1,$2,$3,$4,$5)`, [
        newId(),
        coach.id,
        serviceName,
        data.duration,
        data.priceCad,
      ]);
    }
    return { ok: true as const };
  });

export const saveCoachLocations = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: {
      locations: {
        id?: string;
        name: string;
        address: string;
        kind: string;
        active?: boolean;
        placeId?: string | null;
        lat?: number | null;
        lng?: number | null;
        verified?: boolean;
        city?: string | null;
        timezone?: string | null;
      }[];
    }) => input,
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const coach = await coachForUser(sql, context.userId);
    if (!coach) return { ok: false as const, error: "Sign in required" };
    const named = data.locations.filter((l) => l.name.trim());
    const active = named.filter((l) => l.active !== false);
    if (active.length === 0) return { ok: false as const, error: "Keep at least one location on" };
    const existing = await sql.query<{ id: string }>(`select id from locations where coach_id = $1`, [coach.id]);
    const existingIds = new Set(existing.map((row) => row.id));
    for (const loc of named) {
      const keepId = loc.id && existingIds.has(loc.id) ? loc.id : null;
      if (keepId) {
        await sql.query(
          `update locations
           set name = $1, address = $2, kind = $3, active = $4, place_id = $5, lat = $6, lng = $7, verified = $8
           where id = $9 and coach_id = $10`,
          [
            loc.name.trim(),
            loc.address.trim(),
            loc.kind || "in_person",
            loc.active !== false,
            loc.placeId || null,
            loc.lat ?? null,
            loc.lng ?? null,
            !!loc.verified,
            keepId,
            coach.id,
          ],
        );
      } else {
        await sql.query(
          `insert into locations (id, coach_id, name, address, kind, active, place_id, lat, lng, verified)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            newId(),
            coach.id,
            loc.name.trim(),
            loc.address.trim(),
            loc.kind || "in_person",
            loc.active !== false,
            loc.placeId || null,
            loc.lat ?? null,
            loc.lng ?? null,
            !!loc.verified,
          ],
        );
      }
    }
    const first = named.find((l) => l.active !== false) ?? named[0];
    const city = first?.city || (first?.address ? first.address.split(",").slice(-2).join(",").trim() : "") || coach.city;
    const timezone = first?.timezone && isValidTimezone(first.timezone) ? first.timezone : coach.timezone;
    await sql.query(`update coaches set city = $1, timezone = $2 where id = $3 and user_id = $4`, [
      city,
      timezone,
      coach.id,
      context.userId,
    ]);
    return { ok: true as const };
  });

export const addCoachLocation = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: {
      name: string;
      address: string;
      kind: string;
      placeId?: string | null;
      lat?: number | null;
      lng?: number | null;
      verified?: boolean;
      city?: string | null;
      timezone?: string | null;
    }) => input,
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const coach = await coachForUser(sql, context.userId);
    if (!coach) return { ok: false as const, error: "Sign in required" };
    if (!data.name.trim()) return { ok: false as const, error: "Location name is required" };
    const id = newId();
    await sql.query(
      `insert into locations (id, coach_id, name, address, kind, active, place_id, lat, lng, verified)
       values ($1,$2,$3,$4,$5,true,$6,$7,$8,$9)`,
      [
        id,
        coach.id,
        data.name.trim(),
        data.address.trim(),
        data.kind || "in_person",
        data.placeId || null,
        data.lat ?? null,
        data.lng ?? null,
        !!data.verified,
      ],
    );
    const city = data.city?.trim() || coach.city;
    const timezone = data.timezone && isValidTimezone(data.timezone) ? data.timezone : coach.timezone;
    if (city !== coach.city || timezone !== coach.timezone) {
      await sql.query(`update coaches set city = $1, timezone = $2 where id = $3 and user_id = $4`, [
        city,
        timezone,
        coach.id,
        context.userId,
      ]);
    }
    return { ok: true as const, id };
  });

export const setLocationActive = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; active: boolean }) => guardInput(input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const coach = await coachForUser(sql, context.userId);
    if (!coach) return { ok: false as const, error: "Sign in required" };
    const loc = await sql.query<{ id: string; active: boolean | string }>(
      `select id, active from locations where id = $1 and coach_id = $2`,
      [data.id, coach.id],
    );
    if (!loc[0]) return { ok: false as const, error: "Location not found" };
    if (!data.active) {
      const others = await sql.query<{ n: number }>(
        `select count(*)::int as n from locations where coach_id = $1 and id <> $2 and active = true`,
        [coach.id, data.id],
      );
      if ((others[0]?.n ?? 0) === 0) return { ok: false as const, error: "Keep at least one location on" };
    }
    await sql.query(`update locations set active = $1 where id = $2 and coach_id = $3`, [
      data.active,
      data.id,
      coach.id,
    ]);
    return { ok: true as const };
  });

export const saveCoachHours = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { hours: HourSegment[]; bookAheadDays?: number }) => guardInput(input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const coach = await coachForUser(sql, context.userId);
    if (!coach) return { ok: false as const, error: "Sign in required" };
    const valid = validateWeeklyHours(data.hours);
    if (!valid.ok) return { ok: false as const, error: valid.error };
    await sql.query(`delete from weekly_hours where coach_id = $1`, [coach.id]);
    for (const h of valid.rows) {
      await sql.query(`insert into weekly_hours (id, coach_id, weekday, start_min, end_min) values ($1,$2,$3,$4,$5)`, [
        newId(),
        coach.id,
        h.weekday,
        h.startMin,
        h.endMin,
      ]);
    }
    if (data.bookAheadDays != null) {
      await sql.query(`update coaches set book_ahead_days = $1 where id = $2`, [
        normalizeBookAheadDays(data.bookAheadDays),
        coach.id,
      ]);
    }
    return { ok: true as const };
  });

export const saveCoachAssistantName = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { name: string }) => guardInput(input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const coach = await coachForUser(sql, context.userId);
    if (!coach) return { ok: false as const, error: "Sign in required" };
    const name = normalizeAssistantName(data.name);
    await sql.query(`update coaches set assistant_name = $1 where id = $2 and user_id = $3`, [
      name,
      coach.id,
      context.userId,
    ]);
    return { ok: true as const, assistantName: name };
  });

export type UpcomingLesson = {
  id: string;
  startAt: string;
  clientName: string;
  location: string;
};

export const getUpcomingLesson = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const coach = await coachForUser(sql, context.userId);
    if (!coach) return { ok: false as const, error: "Sign in required" };
    const rows = await sql.query<{
      id: string;
      start_at: string | Date;
      client_name: string;
      location_name: string;
    }>(
      `select l.id, l.start_at, cl.name as client_name, loc.name as location_name
       from lessons l
       join clients cl on cl.id = l.client_id
       join locations loc on loc.id = l.location_id
       where l.coach_id = $1 and l.status = 'confirmed' and l.start_at >= now()
       order by l.start_at asc
       limit 1`,
      [coach.id],
    );
    const row = rows[0];
    if (!row) return { ok: true as const, lesson: null };
    return {
      ok: true as const,
      lesson: {
        id: row.id,
        startAt: asDate(row.start_at)!.toISOString(),
        clientName: row.client_name,
        location: row.location_name,
      } satisfies UpcomingLesson,
    };
  });

export const startCoachTrial = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const coach = await coachForUser(sql, context.userId);
    if (!coach) return { ok: false as const, error: "Sign in required" };
    const stripe = getStripe();
    const price = priceIdForPlan("light");
    if (stripe && price) {
      let customerId = coach.stripe_customer_id;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: coach.email,
          name: coach.name,
          metadata: { coachId: coach.id, kind: "coach_subscription" },
        });
        customerId = customer.id;
        await sql.query(`update coaches set stripe_customer_id = $1 where id = $2`, [customerId, coach.id]);
      }
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        client_reference_id: coach.id,
        line_items: [{ price, quantity: 1 }],
        payment_method_collection: "always",
        subscription_data: {
          trial_period_days: TRIAL_DAYS,
          metadata: { coachId: coach.id, kind: "coach_subscription" },
        },
        metadata: { coachId: coach.id, kind: "coach_subscription" },
        success_url: `${appUrl()}/app/billing?started=1`,
        cancel_url: `${appUrl()}/app/billing`,
      });
      return { ok: true as const, checkoutUrl: session.url };
    }
    const ends = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
    await sql.query(
      `update coaches set subscription_status = 'trialing', plan = 'light', trial_ends_at = $1 where id = $2 and user_id = $3`,
      [ends.toISOString(), coach.id, context.userId],
    );
    return { ok: true as const, trialEndsAt: ends.toISOString() };
  });

export const cancelCoachPlan = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const coach = await coachForUser(sql, context.userId);
    if (!coach) return { ok: false as const, error: "Sign in required" };
    const stripe = getStripe();
    if (stripe && coach.stripe_subscription_id) {
      try {
        await stripe.subscriptions.cancel(coach.stripe_subscription_id);
      } catch {
        // Local cancel still applies if Stripe is missing the sub.
      }
    }
    await sql.query(
      `update coaches set subscription_status = 'canceled' where id = $1 and user_id = $2`,
      [coach.id, context.userId],
    );
    return { ok: true as const };
  });

type LessonJoin = {
  id: string;
  start_at: string | Date;
  end_at: string | Date;
  status: string;
  client_id: string;
  client_name: string;
  client_email: string;
  location_name: string;
  service_name: string;
  duration: number;
  pay_status: string | null;
  pay_method: string | null;
  pending_kind?: string | null;
  source: string;
  series_id: string | null;
  series_payment_status: string | null;
};

function mapLesson(r: LessonJoin, tz: string) {
  const start = asDate(r.start_at)!;
  return {
    id: r.id,
    start: start.toISOString(),
    when: formatWhen(start, tz),
    time: formatTime(start, tz),
    status: r.status,
    statusLabel: lessonStatusLabel(r.status),
    bucket: bookingBucket(r.status, start),
    clientId: r.client_id,
    clientName: r.client_name,
    clientEmail: r.client_email,
    locationName: r.location_name,
    serviceName: r.service_name,
    duration: Number(r.duration),
    pay: payLabel(r.pay_status, r.pay_method, {
      audience: "coach",
      seriesStatusLabel: r.series_id ? paymentStatusLabel(r.series_payment_status) : null,
    }),
    pendingKind: r.pending_kind || null,
    recurring: r.source === "imported_recurring",
    seriesId: r.series_id,
  };
}

const LESSON_JOIN_COLUMNS = `l.id, l.start_at, l.end_at, l.status, cl.id as client_id, cl.name as client_name, cl.email as client_email,
              loc.name as location_name, s.name as service_name, ${DURATION_SQL} as duration,
              p.status as pay_status, p.method as pay_method,
              l.source, l.series_id, rs.payment_status as series_payment_status`;

export const listMyLessons = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const coach = await coachForUser(sql, context.userId);
    if (!coach) return { ok: false as const, error: "Sign in required" };
    const rows = await sql.query<LessonJoin>(
      `select ${LESSON_JOIN_COLUMNS},
              (select br.kind from booking_requests br
               where br.status = 'pending' and (br.lesson_id = l.id or br.other_lesson_id = l.id)
               limit 1) as pending_kind
       from lessons l
       join clients cl on cl.id = l.client_id
       join locations loc on loc.id = l.location_id
       join services s on s.id = l.service_id
       left join payments p on p.lesson_id = l.id
       left join recurring_series rs on rs.id = l.series_id
       where l.coach_id = $1
       order by l.start_at asc`,
      [coach.id],
    );
    const tz = tzOf(coach.timezone);
    return { ok: true as const, timezone: tz, lessons: rows.map((r) => mapLesson(r, tz)) };
  });

export const listMyClients = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const coach = await coachForUser(sql, context.userId);
    if (!coach) return { ok: false as const, error: "Sign in required" };
    const rows = await listCoachClients(sql, coach.id);
    return { ok: true as const, clients: rows };
  });

export const getMyClient = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { id: string }) => guardInput(input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const coach = await coachForUser(sql, context.userId);
    if (!coach) return { ok: false as const, error: "Sign in required" };
    const client = await getCoachClient(sql, coach.id, data.id);
    if (!client) return { ok: false as const, error: "Client not found" };
    const lessons = await sql.query<LessonJoin>(
      `select ${LESSON_JOIN_COLUMNS}
       from lessons l
       join clients cl on cl.id = l.client_id
       join locations loc on loc.id = l.location_id
       join services s on s.id = l.service_id
       left join payments p on p.lesson_id = l.id
       left join recurring_series rs on rs.id = l.series_id
       where l.coach_id = $1 and l.client_id = $2
       order by l.start_at desc`,
      [coach.id, client.id],
    );
    const tz = tzOf(coach.timezone);
    return { ok: true as const, client, lessons: lessons.map((r) => mapLesson(r, tz)) };
  });

export const saveClientNote = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; note: string }) => guardInput(input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const coach = await coachForUser(sql, context.userId);
    if (!coach) return { ok: false as const, error: "Sign in required" };
    const saved = await saveCoachClientNote(sql, coach.id, data.id, data.note);
    if (!saved) return { ok: false as const, error: "Client not found" };
    return { ok: true as const };
  });

export const getMyLesson = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { id: string }) => guardInput(input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const coach = await coachForUser(sql, context.userId);
    if (!coach) return { ok: false as const, error: "Sign in required" };
    const rows = await sql.query<LessonJoin>(
      `select ${LESSON_JOIN_COLUMNS},
              (select br.kind from booking_requests br
               where br.status = 'pending' and (br.lesson_id = l.id or br.other_lesson_id = l.id)
               limit 1) as pending_kind
       from lessons l
       join clients cl on cl.id = l.client_id
       join locations loc on loc.id = l.location_id
       join services s on s.id = l.service_id
       left join payments p on p.lesson_id = l.id
       left join recurring_series rs on rs.id = l.series_id
       where l.id = $1 and l.coach_id = $2`,
      [data.id, coach.id],
    );
    const row = rows[0];
    if (!row) return { ok: false as const, error: "Lesson not found" };
    const tz = tzOf(coach.timezone);
    return { ok: true as const, lesson: mapLesson(row, tz), slug: coach.slug, timezone: tz, today: todayKey(tz) };
  });

export type CoachMoveResult =
  | { ok: true }
  | { ok: false; error: string; outsideHours?: boolean };

async function moveLessonForCoach(
  userId: string,
  data: { lessonId: string; start: string; allowOutsideHours?: boolean },
): Promise<CoachMoveResult> {
  const sql = await getSql();
  const coach = await coachForUser(sql, userId);
  if (!coach) return { ok: false, error: "Sign in required" };
  const next = new Date(data.start);
  if (Number.isNaN(next.getTime())) return { ok: false, error: "Pick a new time" };
  const tz = tzOf(coach.timezone);
  type MoveRow = {
    id: string;
    status: string;
    start_at: string | Date;
    duration: number;
    client_name: string;
    client_email: string | null;
    source: string;
  };
  const readLesson = async (q: Pick<Sql, "query">) =>
    (
      await q.query<MoveRow>(
        `select l.id, l.status, l.start_at, ${DURATION_SQL} as duration, cl.name as client_name, cl.email as client_email, l.source
         from lessons l join services s on s.id = l.service_id join clients cl on cl.id = l.client_id
         where l.id = $1 and l.coach_id = $2`,
        [data.lessonId, coach.id],
      )
    )[0];
  const before = await readLesson(sql);
  if (!before) return { ok: false, error: "Lesson not found" };
  if (!canMoveLesson(before.status)) return { ok: false, error: "That lesson cannot be moved" };

  const result = await withTransaction(async (tx): Promise<CoachMoveResult> => {
    await lockCoachSchedule(tx, coach.id);
    const lesson = await readLesson(tx);
    if (!lesson || !canMoveLesson(lesson.status)) return { ok: false, error: "That lesson cannot be moved" };
    const duration = Number(lesson.duration);
    const dateKey = dateKeyAt(next, tz);
    const endAt = new Date(next.getTime() + duration * 60 * 1000);
    if (lesson.source === "imported_recurring") {
      // Regular weekly lessons may move outside public hours (with a warning),
      // but never onto another lesson, an open checkout hold or a blocked day.
      const startMin = minutesAt(next, tz);
      const exact = zonedInstantExact(dateKey, startMin, tz);
      if (!exact || exact.getTime() !== next.getTime()) return { ok: false, error: "Pick a valid time" };
      if (startMin + duration > 1440) return { ok: false, error: "That lesson would run past midnight." };
      const taken = await tx.query<{
        id: string;
        start_at: string | Date;
        end_at: string | Date;
        status: string;
        hold_until: string | Date | null;
        client_name: string;
      }>(
        `select l.id, l.start_at, l.end_at, l.status, l.hold_until, cl.name as client_name
         from lessons l join clients cl on cl.id = l.client_id
         where l.coach_id = $1 and l.status in ('confirmed', 'held') and l.start_at < $3 and l.end_at > $2`,
        [coach.id, next.toISOString(), endAt.toISOString()],
      );
      const blocks = await tx.query<{ date: string; start_min: number; end_min: number }>(
        `select date, start_min, end_min from date_blocks where coach_id = $1 and date = $2`,
        [coach.id, dateKey],
      );
      const conflict = conflictFor(
        { dateKey, startMin, durationMin: duration, start: next, end: endAt },
        taken.map((t) => ({
          id: t.id,
          start: asDate(t.start_at)!,
          end: asDate(t.end_at)!,
          status: t.status,
          holdUntil: asDate(t.hold_until),
          clientName: t.client_name,
        })),
        blocks.map((b) => ({ date: b.date, startMin: b.start_min, endMin: b.end_min })),
        new Date(),
        { ignoreLessonId: lesson.id },
      );
      if (conflict) return { ok: false, error: conflict.detail };
      const hours = await tx.query<{ weekday: number; start_min: number; end_min: number }>(
        `select weekday, start_min, end_min from weekly_hours where coach_id = $1`,
        [coach.id],
      );
      const outside = isOutsideHours(
        { weekday: weekdayOf(dateKey), startMin, durationMin: duration },
        hours.map((h) => ({ weekday: h.weekday, startMin: h.start_min, endMin: h.end_min })),
      );
      if (outside && !data.allowOutsideHours) {
        return { ok: false, outsideHours: true, error: "Not in your public hours. It will still hold the slot." };
      }
    } else {
      const slots = await openSlots(tx, coach.id, dateKey, duration);
      if (!slots.includes(next.toISOString())) return { ok: false, error: "That time is not open" };
    }
    await tx.query(
      `update lessons set start_at = $1, end_at = $2, status = $3, reminded_24h = false, reminded_2h = false where id = $4 and coach_id = $5`,
      [next.toISOString(), endAt.toISOString(), statusAfterReschedule(lesson.status), lesson.id, coach.id],
    );
    return { ok: true };
  });
  if (!result.ok) return result;
  for (const mail of changeMails({
    kind: "rescheduled",
    coachName: coach.name,
    coachEmail: coach.email,
    studentName: before.client_name,
    studentEmail: before.client_email || "",
    when: formatWhen(asDate(before.start_at)!, tz),
    nextWhen: formatWhen(next, tz),
    manageUrl: `${appUrl()}/manage?email=${encodeURIComponent(before.client_email || "")}`,
  })) {
    await sendMail(mail);
  }
  return { ok: true };
}

export const coachMoveLesson = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { lessonId: string; start: string; allowOutsideHours?: boolean }) => guardInput(input))
  .handler(async ({ context, data }) => moveLessonForCoach(context.userId, data));

async function applyCancelLesson(sql: Pick<Sql, "query">, coach: CoachRow, lessonId: string) {
  const rows = await sql.query<{
    id: string;
    start_at: string | Date;
    client_name: string;
    client_email: string;
    pay_method: string | null;
    pay_status: string | null;
    pay_intent: string | null;
  }>(
    `select l.id, l.start_at, cl.name as client_name, cl.email as client_email,
            p.method as pay_method, p.status as pay_status, p.stripe_payment_intent_id as pay_intent
     from lessons l
     join clients cl on cl.id = l.client_id
     left join payments p on p.lesson_id = l.id
     where l.id = $1 and l.coach_id = $2`,
    [lessonId, coach.id],
  );
  const lesson = rows[0];
  if (!lesson) return { ok: false as const, error: "Lesson not found" };
  if (lesson.pay_method === "card" && lesson.pay_status === "paid") {
    const stripe = getStripe();
    if (stripe && lesson.pay_intent) {
      // Coach cancels: full refund; the transfer is reversed and the platform
      // returns its application fee (the platform bears it).
      await stripe.refunds.create({
        payment_intent: lesson.pay_intent,
        reverse_transfer: true,
        refund_application_fee: true,
      });
    }
    await sql.query(`update payments set status = 'refunded' where lesson_id = $1`, [lesson.id]);
  }
  await sql.query(`update lessons set status = 'cancelled' where id = $1 and coach_id = $2`, [lesson.id, coach.id]);
  for (const mail of changeMails({
    kind: "cancelled",
    coachName: coach.name,
    coachEmail: coach.email,
    studentName: lesson.client_name,
    studentEmail: lesson.client_email,
    when: formatWhen(asDate(lesson.start_at)!, tzOf(coach.timezone)),
    manageUrl: `${appUrl()}/manage?email=${encodeURIComponent(lesson.client_email || "")}`,
  })) {
    await sendMail(mail, { bookingId: lesson.id, template: "cancelled" });
  }
  pushLater(() =>
    pushToStudentEmail(sql, lesson.client_email, {
      title: "Lesson cancelled",
      body: `${coach.name} cancelled ${formatWhen(asDate(lesson.start_at)!, tzOf(coach.timezone))}`,
      path: "/manage",
    }),
  );
  return { ok: true as const, message: "Cancelled the lesson with " + lesson.client_name + ". They were emailed." };
}

export const coachCancelLesson = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { lessonId: string }) => guardInput(input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const coach = await coachForUser(sql, context.userId);
    if (!coach) return { ok: false as const, error: "Sign in required" };
    return applyCancelLesson(sql, coach, data.lessonId);
  });

export const coachNextWeek = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { lessonId: string }) => guardInput(input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const coach = await coachForUser(sql, context.userId);
    if (!coach) return { ok: false as const, error: "Sign in required" };
    const rows = await sql.query<{
      id: string;
      status: string;
      start_at: string | Date;
      end_at: string | Date;
      service_id: string;
      location_id: string;
      client_id: string;
      duration: number;
      client_name: string;
      client_email: string;
      source: string;
    }>(
      `select l.id, l.status, l.start_at, l.end_at, l.service_id, l.location_id, l.client_id, ${DURATION_SQL} as duration,
              cl.name as client_name, cl.email as client_email, l.source
       from lessons l join services s on s.id = l.service_id join clients cl on cl.id = l.client_id
       where l.id = $1 and l.coach_id = $2`,
      [data.lessonId, coach.id],
    );
    const lesson = rows[0];
    if (!lesson || lesson.status !== "confirmed") return { ok: false as const, error: "Lesson not found" };
    if (lesson.source === "imported_recurring") {
      return { ok: false as const, error: "This lesson is part of a regular weekly schedule." };
    }
    const tz = tzOf(coach.timezone);
    const was = asDate(lesson.start_at)!;
    const nextKey = addDaysKey(dateKeyAt(was, tz), 7);
    const start = zonedInstantExact(nextKey, minutesAt(was, tz), tz);
    if (!start) return { ok: false as const, error: "That time next week is not open" };
    const duration = Number(lesson.duration);
    const end = new Date(start.getTime() + duration * 60 * 1000);
    const id = newId();
    const booked = await withTransaction(async (tx) => {
      await lockCoachSchedule(tx, coach.id);
      const slots = await openSlots(tx, coach.id, nextKey, duration);
      if (!slots.includes(start.toISOString())) return false;
      await tx.query(
        `insert into lessons (id, coach_id, service_id, location_id, client_id, start_at, end_at, status)
         values ($1,$2,$3,$4,$5,$6,$7,'confirmed')`,
        [id, coach.id, lesson.service_id, lesson.location_id, lesson.client_id, start.toISOString(), end.toISOString()],
      );
      return true;
    });
    if (!booked) return { ok: false as const, error: "That time next week is not open" };
    for (const mail of changeMails({
      kind: "next_week_cash",
      coachName: coach.name,
      coachEmail: coach.email,
      studentName: lesson.client_name,
      studentEmail: lesson.client_email,
      when: formatWhen(was, tz),
      nextWhen: formatWhen(start, tz),
    })) {
      await sendMail(mail);
    }
    return { ok: true as const, id };
  });

export type AssistantPreview = {
  kind?: string;
  heading?: string;
  footer?: string;
  note?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  fields?: { label: string; value: string }[];
  groups?: { dateKey: string; label: string; lines: string[] }[];
  importPlan?: RecurringPreview;
  href?: string;
};

/** Coach + bundle → what the recurring import needs. */
export function importCoachFrom(coach: CoachRow, bundle: Awaited<ReturnType<typeof loadCoachBundle>>): ImportCoach {
  return {
    id: coach.id,
    timezone: tzOf(coach.timezone),
    open: bundle.open,
    service: bundle.services[0] ? { id: bundle.services[0].id, duration: Number(bundle.services[0].duration) } : null,
    locations: bundle.activeLocations.map((l) => ({ id: l.id, name: l.name })),
    hours: bundle.hours.map((h) => ({ weekday: h.weekday, startMin: h.start_min, endMin: h.end_min })),
  };
}

function previewClock(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const ap = h >= 12 ? "p.m." : "a.m.";
  const hr = ((h + 11) % 12) + 1;
  return hr + ":" + String(m).padStart(2, "0") + " " + ap;
}

function bundleLocName(locations: { name: string; kind: string }[]) {
  return (locations.find((l) => l.kind !== "online") || locations[0])?.name || "";
}

function previewForAction(
  action: AssistantAction,
  ctx: { timezone: string; lessons: { id: string; clientName: string; startAt: string; location: string }[] },
): AssistantPreview | null {
  const tz = ctx.timezone;
  if (action.type === "draft_email") {
    const lesson = ctx.lessons.find((l) => l.id === action.lessonId);
    if (!lesson) return null;
    return {
      kind: "email",
      heading: "Preview · Send email",
      fields: [
        { label: "To", value: lesson.clientName },
        { label: "About", value: formatWhen(new Date(lesson.startAt), tz) + " at " + lesson.location },
        { label: "Draft", value: action.body },
      ],
      confirmLabel: "Send email",
      cancelLabel: "Don't send",
    };
  }
  if (action.type === "draft_reschedule" && action.op === "block") {
    const label = formatDateKey(action.dateKey);
    return {
      kind: "hours",
      heading: "Preview · Change hours",
      fields: [{ label: "", value: label + " · " + previewClock(action.startMin) + "–" + previewClock(action.endMin) }],
      note: "Will be blocked. Existing lessons that day stay.",
      footer: "Nothing applied until Confirm.",
      confirmLabel: "Confirm change",
      cancelLabel: "Keep hours",
    };
  }
  if (action.type === "draft_reschedule" && action.op === "move") {
    const lesson = ctx.lessons.find((l) => l.id === action.lessonId);
    if (!lesson) return null;
    return {
      kind: "move",
      heading: "Preview · Reschedule",
      fields: [
        { label: "Student", value: lesson.clientName },
        { label: "From", value: formatWhen(new Date(lesson.startAt), tz) },
        { label: "To", value: formatWhen(new Date(action.start), tz) },
      ],
      footer: "Same price. Confirm to apply and email the student.",
      confirmLabel: "Confirm change",
      cancelLabel: "Keep lesson",
    };
  }
  if (action.type === "draft_swap") {
    const a = ctx.lessons.find((l) => l.id === action.lessonAId);
    const b = ctx.lessons.find((l) => l.id === action.lessonBId);
    if (!a || !b) return null;
    return {
      kind: "swap",
      heading: "Preview · Swap times",
      fields: [
        { label: firstName(a.clientName), value: formatWhen(new Date(a.startAt), tz) + " → " + formatWhen(new Date(b.startAt), tz) },
        { label: firstName(b.clientName), value: formatWhen(new Date(b.startAt), tz) + " → " + formatWhen(new Date(a.startAt), tz) },
        { label: "Note", value: action.note },
      ],
      note: "Both students get an email and must accept. Nothing moves until then.",
      footer: "Nothing applied until Confirm.",
      confirmLabel: "Send to both students",
      cancelLabel: "Don't send",
    };
  }
  if (action.type === "cancel_lesson") {
    const lesson = ctx.lessons.find((l) => l.id === action.lessonId);
    if (!lesson) return null;
    return {
      kind: "cancel",
      heading: "Preview · Cancel lesson",
      fields: [
        { label: "Student", value: lesson.clientName },
        { label: "When", value: formatWhen(new Date(lesson.startAt), tz) + (lesson.location ? " at " + lesson.location : "") },
      ],
      note: "We'll email the student. Card payments are refunded.",
      footer: "Nothing applied until Confirm.",
      confirmLabel: "Cancel lesson",
      cancelLabel: "Keep lesson",
    };
  }
  return null;
}

type AssistantInput = { text?: string; confirm?: boolean; action?: AssistantAction };

export type AssistantTurn =
  | { ok: false; error: string; upgrade?: true }
  | {
      ok: true;
      message?: string;
      summary?: string;
      needsConfirm?: boolean;
      action?: AssistantAction;
      preview?: AssistantPreview | null;
      importForm?: true;
    };

async function processAssistantTurn(userId: string, data: AssistantInput): Promise<AssistantTurn> {
    const sql = await getSql();
    const coach = await coachForUser(sql, userId);
    if (!coach) return { ok: false as const, error: "Sign in required" };
    if (!hasCapability(coach.plan, "list_availability", coach.subscription_status, asDate(coach.trial_ends_at))) {
      return { ok: false as const, error: "Assistant is on Coach", upgrade: true as const };
    }
    const clients = await listCoachClientNames(sql, coach.id);
    const lessons = await sql.query<{
      id: string;
      client_id: string;
      client_name: string;
      start_at: string | Date;
      status: string;
      location_name: string;
    }>(
      `select l.id, l.client_id, cl.name as client_name, l.start_at, l.status, loc.name as location_name
       from lessons l join clients cl on cl.id = l.client_id join locations loc on loc.id = l.location_id
       where l.coach_id = $1`,
      [coach.id],
    );
    const tz = tzOf(coach.timezone);
    const ctx = {
      todayKey: todayKey(tz),
      timezone: tz,
      clients: clients.map((c) => ({ id: c.id, name: c.name })),
      lessons: lessons.map((l) => ({
        id: l.id,
        clientId: l.client_id,
        clientName: l.client_name,
        startAt: asDate(l.start_at)!.toISOString(),
        status: l.status,
        location: l.location_name,
      })),
    };
    // Recurring import: a client-supplied action only ever previews; writing
    // needs confirm + the fingerprint the server computes for that preview.
    if (data.action?.type === "draft_import") {
      const lang = data.action.lang === "zh" ? "zh" : "en";
      if (data.confirm) return confirmImportTurn(coach, data.action.rule, data.action.fingerprint || "", lang);
      return previewImportTurn(sql, coach, data.action.rule, lang);
    }
    const providerName = process.env.ASSISTANT_PROVIDER || (process.env.XAI_API_KEY ? "grok" : "local");
    const providerKind = resolveAssistantProvider(providerName).name;
    if (!data.action && (providerKind === "local") && looksLikeImportRequest(data.text || "")) {
      return importFormTurn(detectLang(data.text || ""));
    }
    const bundleForImport = await loadCoachBundle(sql, coach);
    const capabilities: Capability[] = [
      ...planCapabilities(coach.plan, coach.subscription_status, asDate(coach.trial_ends_at)),
      ...(bundleForImport.open ? (["draft_import"] as const) : []),
    ];
    const parsed = data.action
      ? { ok: true as const, action: data.action, summary: "", needsConfirm: false, text: "" }
      : await (async () => {
          const provider = resolveAssistantProvider(providerName);
          if (provider.name !== "local") {
            const result = await provider.chat({
              coachId: coach.id,
              message: data.text || "",
              capabilities,
              assistantName: normalizeAssistantName(coach.assistant_name),
              context: ctx,
            });
            if (!result.ok) {
              logAssistantFailure({ coachId: coach.id, provider: provider.name, error: result.error });
              if (looksLikeImportRequest(data.text || "")) {
                return { ok: true as const, action: undefined, summary: "", needsConfirm: false, text: "", importForm: true as const };
              }
              const fallback = parseAssistant(data.text || "", ctx);
              return fallback.ok
                ? { ...fallback, text: fallback.summary }
                : { ok: false as const, error: result.error };
            }
            return {
              ok: true as const,
              action: result.action,
              summary: result.summary || result.text,
              needsConfirm: !!result.needsConfirm,
              text: result.text,
            };
          }
          const local = parseAssistant(data.text || "", ctx);
          return local.ok ? { ...local, text: local.summary } : local;
        })();
    if (!parsed.ok) return parsed;
    if ("importForm" in parsed && parsed.importForm) return importFormTurn(detectLang(data.text || ""));
    if (!parsed.action) return { ok: true as const, message: parsed.text || parsed.summary || "Done." };
    if (parsed.action.type === "draft_import") {
      return previewImportTurn(sql, coach, parsed.action.rule, detectLang(data.text || ""));
    }
    let action = parsed.action;
    if (action.type === "draft_email") {
      action = {
        ...action,
        body: signEmailAsCoach(action.body, coach.name, coach.assistant_name || undefined),
      };
    }
    if (parsed.needsConfirm && !data.confirm) {
      return {
        ok: true as const,
        needsConfirm: true,
        action,
        summary: parsed.summary,
        preview: previewForAction(action, ctx),
      };
    }
    if (action.type === "list_availability") {
      const service = (await sql.query<ServiceRow>(`select id, name, duration, price_cad from services where coach_id = $1 limit 1`, [coach.id]))[0];
      const duration = service?.duration || 60;
      const locName =
        bundleLocName(await sql.query<{ name: string; kind: string }>(
          `select name, kind from locations where coach_id = $1 and active = true order by name`,
          [coach.id],
        ));
      const groups: { dateKey: string; label: string; lines: string[] }[] = [];
      const until = lastBookableDateKey(normalizeBookAheadDays(coach.book_ahead_days), ctx.todayKey);
      const days = Math.max(1, Math.min(31, Math.floor(Number(action.days) || 1)));
      for (let i = 0; i < days; i++) {
        const useKey = shiftDateKey(action.dateKey, i);
        if (useKey > until) continue;
        const slots = await openSlots(sql, coach.id, useKey, duration);
        if (!slots.length && days > 1) continue;
        const label = formatDateKey(useKey);
        groups.push({
          dateKey: useKey,
          label,
          lines: slots.map((s) => formatTime(new Date(s), tz) + (locName ? " · " + locName : "")),
        });
      }
      const message = groups.length
        ? groups.map((g) => g.label + (g.lines.length ? ": " + g.lines.join(", ") : ": none")).join(" / ")
        : "No openings in that window.";
      return {
        ok: true as const,
        message,
        preview: {
          kind: "openings",
          heading: "",
          footer: "Openings only. Nothing was changed.",
          groups,
        },
      };
    }
    if (action.type === "list_lessons") {
      const upcoming = upcomingLessons(ctx.lessons);
      if (!upcoming.length) return { ok: true as const, message: "No upcoming lessons." };
      const groups: { dateKey: string; label: string; lines: string[] }[] = [];
      for (const lesson of upcoming) {
        const dateKey = slotDateKey(lesson.startAt, tz);
        const label = formatDateKey(dateKey);
        const line = formatTime(new Date(lesson.startAt), tz) + " · " + lesson.clientName + (lesson.location ? " · " + lesson.location : "");
        const last = groups[groups.length - 1];
        if (last && last.dateKey === dateKey) last.lines.push(line);
        else groups.push({ dateKey, label, lines: [line] });
      }
      const message = groups.map((g) => g.label + ": " + g.lines.join(", ")).join(" / ");
      return {
        ok: true as const,
        message,
        preview: { kind: "schedule", heading: "Upcoming lessons", groups },
      };
    }
    if (action.type === "draft_email") {
      const lesson = ctx.lessons.find((l) => l.id === action.lessonId);
      if (!lesson) return { ok: false as const, error: "Lesson not found" };
      const client = ctx.clients.find((c) => c.id === lesson.clientId);
      const contact = await getCoachClient(sql, coach.id, lesson.clientId);
      const emailRow = contact ? [contact] : [];
      if (!emailRow[0]) return { ok: false as const, error: "Client not found" };
      await sendMail(studentMessageMail({
        studentEmail: emailRow[0].email,
        studentName: emailRow[0].name,
        coachName: coach.name,
        body: action.body,
      }));
      return { ok: true as const, message: "Email sent to " + (client?.name || emailRow[0].name) + "." };
    }
    if (action.type === "draft_swap") {
      const result = await createCoachSwap(sql, coach, action.lessonAId, action.lessonBId, action.note);
      if (!result.ok) return result;
      return { ok: true as const, message: result.message };
    }
    if (action.type === "cancel_lesson") {
      const result = await applyCancelLesson(sql, coach, action.lessonId);
      if (!result.ok) return result;
      return { ok: true as const, message: result.message };
    }
    if (action.op === "block") {
      const existing = await sql.query<{ id: string }>(
        `select id from date_blocks where coach_id = $1 and date = $2 limit 1`,
        [coach.id, action.dateKey],
      );
      if (existing[0]) {
        await sql.query(`update date_blocks set start_min = $1, end_min = $2 where id = $3`, [
          action.startMin,
          action.endMin,
          existing[0].id,
        ]);
      } else {
        await sql.query(
          `insert into date_blocks (id, coach_id, date, start_min, end_min) values ($1,$2,$3,$4,$5)`,
          [newId(), coach.id, action.dateKey, action.startMin, action.endMin],
        );
      }
      return { ok: true as const, message: `Blocked openings on ${action.dateKey}. Existing lessons stay.` };
    }
    const move = await moveLessonForCoach(userId, { lessonId: action.lessonId, start: action.start });
    if (!move.ok) {
      return {
        ok: false as const,
        error: move.outsideHours
          ? "That time is outside your public hours. Open the lesson page to move it there."
          : move.error,
      };
    }
    return { ok: true as const, message: "Lesson moved. The student was emailed." };
}

function importFormTurn(lang: "zh" | "en"): AssistantTurn {
  return {
    ok: true as const,
    importForm: true as const,
    message:
      lang === "zh"
        ? "固定课表请用导入表单填写（可一次设置多个星期和时间），确认前不会写入。"
        : "Use the import form for regular weekly lessons — you can add several weekdays and times, and nothing is saved until you confirm.",
    preview: {
      kind: "import_form",
      heading: lang === "zh" ? "导入固定课表" : "Import recurring schedule",
      href: "/app/import",
    },
  };
}

function importCard(plan: RecurringPreview): AssistantPreview {
  return {
    kind: "import",
    importPlan: plan,
    confirmLabel: `Import ${plan.createCount} lesson${plan.createCount === 1 ? "" : "s"}`,
    cancelLabel: "Don't import",
  };
}

async function previewImportTurn(sql: Sql, coach: CoachRow, rule: RecurringRuleInput, lang: "zh" | "en"): Promise<AssistantTurn> {
  const bundle = await loadCoachBundle(sql, coach);
  const built = await buildImportPlan(sql, importCoachFrom(coach, bundle), rule);
  if (!built.ok) {
    return { ok: false as const, error: (lang === "zh" ? "无法预览导入：" : "Can't preview the import: ") + built.error };
  }
  const plan = built.plan.preview;
  const action: AssistantAction = { type: "draft_import", rule, fingerprint: plan.fingerprint, lang };
  return {
    ok: true as const,
    needsConfirm: true as const,
    action,
    summary: recapImport(plan, lang),
    preview: importCard(plan),
  };
}

async function confirmImportTurn(
  coach: CoachRow,
  rule: RecurringRuleInput,
  fingerprint: string,
  lang: "zh" | "en",
): Promise<AssistantTurn> {
  const sql = await getSql();
  const bundle = await loadCoachBundle(sql, coach);
  const importCoach = importCoachFrom(coach, bundle);
  const result = await withTransaction(async (tx) => {
    await lockCoachSchedule(tx, coach.id);
    return confirmImport(tx, importCoach, rule, fingerprint, "assistant");
  });
  if (!result.ok) {
    if (result.stale) {
      const action: AssistantAction = { type: "draft_import", rule, fingerprint: result.preview.fingerprint, lang };
      return {
        ok: true as const,
        needsConfirm: true as const,
        action,
        summary:
          (lang === "zh" ? "日历在预览后有变动，以下是更新后的数字，请再次确认。\n" : "Your calendar changed since the preview. Here are the updated numbers — confirm again.\n") +
          recapImport(result.preview, lang),
        preview: importCard(result.preview),
      };
    }
    return { ok: false as const, error: result.error };
  }
  await sendImportNotice(coach, result.done);
  const n = result.done.created;
  return {
    ok: true as const,
    message:
      lang === "zh"
        ? `已为 ${result.done.clientName} 导入 ${n} 节固定课，跳过 ${result.done.skipped} 节。`
        : `Imported ${n} lesson${n === 1 ? "" : "s"} for ${result.done.clientName}; ${result.done.skipped} skipped.`,
    preview: {
      kind: "import_done",
      heading: lang === "zh" ? "固定课表已导入" : "Recurring schedule imported",
      fields: [
        { label: "Student", value: result.done.clientName },
        { label: "Lessons", value: `${n} created · ${result.done.skipped} skipped` },
      ],
      href: `/app/series/${result.done.seriesId}`,
    },
  };
}

/** Optional "added to your schedule" email (English, off by default). */
export async function sendImportNotice(coach: CoachRow, done: ImportDone) {
  if (!done.preview.notifyStudent || !done.clientEmail) return;
  await sendMail(
    recurringAddedMail({
      studentEmail: done.clientEmail,
      studentName: done.clientName,
      coachName: coach.name,
      slots: done.preview.slots.map((sl) => sl.label),
      repeat: done.preview.intervalWeeks === 2 ? "Every 2 weeks" : "Every week",
      startLabel: done.preview.startLabel,
      endLabel: done.preview.endLabel,
      count: done.created,
      location: done.preview.location.name,
      timezone: done.preview.timezone,
      manageUrl: `${appUrl()}/manage?email=${encodeURIComponent(done.clientEmail)}`,
    }),
    { template: "recurring_added" },
  );
}

export const runAssistant = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: AssistantInput) => guardInput(input))
  .handler(async ({ context, data }) => processAssistantTurn(context.userId, data));

function xaiKey() {
  return String(process.env.XAI_API_KEY || "").trim();
}

async function xaiTranscribe(audioB64: string, mime = "audio/webm") {
  const apiKey = xaiKey();
  if (!apiKey) return { ok: false as const, error: "Voice is not available.", fallback: true as const };
  let bytes: Buffer;
  try {
    bytes = Buffer.from(audioB64, "base64");
  } catch {
    return { ok: false as const, error: "I didn't catch that." };
  }
  if (bytes.length < 64) return { ok: false as const, error: "I didn't catch that." };
  if (bytes.length > 1_500_000) return { ok: false as const, error: "That clip was too long." };
  const form = new FormData();
  const type = mime.split(";")[0] || "audio/webm";
  form.append("file", new Blob([new Uint8Array(bytes)], { type }), audioFilename(mime));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch("https://api.x.ai/v1/stt", {
      method: "POST",
      headers: { Authorization: "Bearer " + apiKey },
      body: form,
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false as const, error: "I couldn't hear that. Try again." };
    const body = (await res.json()) as { text?: string };
    const text = String(body.text || "").trim();
    if (!text) return { ok: false as const, error: "I didn't catch that." };
    return { ok: true as const, text };
  } catch {
    return { ok: false as const, error: "I couldn't hear that. Try again." };
  } finally {
    clearTimeout(timer);
  }
}

async function xaiSpeak(text: string) {
  const apiKey = xaiKey();
  if (!apiKey) return { ok: false as const, fallback: true as const, error: "Voice is not available." };
  const spoken = capSpokenText(speakableText(text));
  if (!spoken) return { ok: false as const, error: "Nothing to say." };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch("https://api.x.ai/v1/tts", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: spoken, voice_id: "eve", language: ttsLanguage(spoken) }),
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false as const, fallback: true as const, error: "Voice failed." };
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 100) return { ok: false as const, fallback: true as const, error: "Voice failed." };
    return { ok: true as const, audio: buf.toString("base64"), mime: "audio/mpeg" as const };
  } catch {
    return { ok: false as const, fallback: true as const, error: "Voice failed." };
  } finally {
    clearTimeout(timer);
  }
}

async function requireAssistantCoach(userId: string) {
  const sql = await getSql();
  const coach = await coachForUser(sql, userId);
  if (!coach) return { ok: false as const, error: "Sign in required" };
  if (!hasCapability(coach.plan, "list_availability", coach.subscription_status, asDate(coach.trial_ends_at))) {
    return { ok: false as const, error: "Assistant is on Coach", upgrade: true as const };
  }
  return { ok: true as const, coach };
}

export const hearAssistant = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { audio: string; mime?: string }) => guardInput(input))
  .handler(async ({ context, data }) => {
    const gate = await requireAssistantCoach(context.userId);
    if (!gate.ok) return gate;
    return xaiTranscribe(data.audio, data.mime);
  });

export const speakAssistant = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { text: string }) => guardInput(input))
  .handler(async ({ context, data }) => {
    const gate = await requireAssistantCoach(context.userId);
    if (!gate.ok) return gate;
    return xaiSpeak(data.text);
  });

export const voiceTurn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { audio: string; mime?: string }) => guardInput(input))
  .handler(async ({ context, data }) => {
    const heard = await xaiTranscribe(data.audio, data.mime);
    if (!heard.ok) return heard;
    const turn = await processAssistantTurn(context.userId, { text: heard.text });
    const spoken = spokenFromTurn(turn);
    const speech = turn.ok || "error" in turn ? await xaiSpeak(spoken) : null;
    return {
      ...turn,
      transcript: heard.text,
      audio: speech && speech.ok ? speech.audio : undefined,
      mime: speech && speech.ok ? speech.mime : undefined,
      fallbackAudio: speech && !speech.ok && "fallback" in speech ? true : undefined,
    };
  });

export const mintVoiceSession = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const gate = await requireAssistantCoach(context.userId);
    if (!gate.ok) return gate;
    const apiKey = xaiKey();
    if (!apiKey) {
      return { ok: false as const, fallback: true as const, error: "Live talk isn't available right now." };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch("https://api.x.ai/v1/realtime/client_secrets", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ expires_after: { seconds: TOKEN_TTL_SECONDS } }),
        signal: controller.signal,
      });
      if (!res.ok) {
        await res.text().catch(() => "");
        return { ok: false as const, fallback: true as const, error: "Live talk isn't available right now." };
      }
      const secret = extractClientSecret(await res.json());
      if (!secret) {
        return { ok: false as const, fallback: true as const, error: "Live talk isn't available right now." };
      }
      return {
        ok: true as const,
        token: secret.token,
        expiresAt: secret.expiresAt,
        url: REALTIME_WS_URL,
        voice: VOICE_ID,
        coachName: gate.coach.name,
        assistantName: normalizeAssistantName(gate.coach.assistant_name),
      };
    } catch {
      return { ok: false as const, fallback: true as const, error: "Live talk isn't available right now." };
    } finally {
      clearTimeout(timer);
    }
  });

export const collectLesson = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { lessonId: string }) => guardInput(input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const coach = await coachForUser(sql, context.userId);
    if (!coach) return { ok: false as const, error: "Sign in required" };
    const rows = await sql.query<{
      id: string;
      status: string;
      method: string | null;
    }>(
      `select l.id, l.status, p.method
       from lessons l left join payments p on p.lesson_id = l.id
       where l.id = $1 and l.coach_id = $2`,
      [data.lessonId, coach.id],
    );
    const lesson = rows[0];
    if (!lesson || lesson.status === "cancelled") return { ok: false as const, error: "Lesson not found" };
    if (lesson.method !== "cash" && lesson.method !== "offline") {
      return { ok: false as const, error: "Only in-person or offline payments can be marked collected" };
    }
    await sql.query(`update payments set status = 'marked_offline' where lesson_id = $1`, [lesson.id]);
    return { ok: true as const };
  });

export const saveAcceptedMethods = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { acceptCard: boolean; acceptCash: boolean }) => guardInput(input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const coach = await coachForUser(sql, context.userId);
    if (!coach) return { ok: false as const, error: "Sign in required" };
    if (data.acceptCard && !coach.stripe_account_id) {
      return { ok: false as const, error: "Connect Stripe to take cards" };
    }
    const next = normalizeAccepted(!!data.acceptCard, !!data.acceptCash);
    if (!next) return { ok: false as const, error: "Keep at least one payment method on" };
    await sql.query(`update coaches set accept_card = $1, accept_cash = $2 where id = $3 and user_id = $4`, [
      next.acceptCard,
      next.acceptCash,
      coach.id,
      context.userId,
    ]);
    return { ok: true as const };
  });

export const connectStripe = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const coach = await coachForUser(sql, context.userId);
    if (!coach) return { ok: false as const, error: "Sign in required" };
    const stripe = getStripe();
    if (!stripe) return { ok: false as const, error: "Stripe is not configured", configured: false as const };
    try {
      let accountId = coach.stripe_account_id;
      if (!accountId) {
        const base = {
          type: "express" as const,
          country: "CA",
          email: coach.email,
          metadata: { coachId: coach.id },
        };
        let account;
        try {
          account = await stripe.accounts.create({
            ...base,
            capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Stripe error";
          if (/signed up for Connect/i.test(message)) throw err;
          account = await stripe.accounts.create(base);
        }
        accountId = account.id;
        await sql.query(`update coaches set stripe_account_id = $1 where id = $2`, [accountId, coach.id]);
      }
      const link = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${appUrl()}/app/more/payments?connect=refresh`,
        return_url: `${appUrl()}/app/more/payments?connect=return`,
        type: "account_onboarding",
      });
      return { ok: true as const, url: link.url, connected: true as const };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Stripe error";
      const needsConnectSignup = /signed up for Connect/i.test(message);
      return {
        ok: false as const,
        error: needsConnectSignup
          ? "Turn on Stripe Connect at dashboard.stripe.com/connect, then try Card again"
          : message,
      };
    }
  });

export const placesStatus = createServerFn({ method: "GET" }).handler(async () => {
  return { configured: isPlacesConfigured() };
});

export const placesAutocomplete = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { q: string }) => guardInput(input))
  .handler(async ({ data }) => {
    if (!isPlacesConfigured()) {
      return { configured: false as const, suggestions: [] as PlaceSuggestion[] };
    }
    const q = data.q.trim();
    if (q.length < 2) return { configured: true as const, suggestions: [] as PlaceSuggestion[] };
    const key = googleMapsApiKey()!;
    const url = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
    url.searchParams.set("input", q);
    url.searchParams.set("key", key);
    url.searchParams.set("types", "address");
    try {
      const res = await fetch(url.toString());
      const body = await res.json();
      if (body.status && body.status !== "OK" && body.status !== "ZERO_RESULTS") {
        return { configured: true as const, suggestions: [] as PlaceSuggestion[], error: body.status, allowManual: true };
      }
      const suggestions: PlaceSuggestion[] = (body.predictions || []).slice(0, 6).map(
        (p: {
          place_id: string;
          description: string;
          structured_formatting?: { main_text?: string; secondary_text?: string };
        }) => ({
          placeId: p.place_id,
          description: p.description,
          mainText: p.structured_formatting?.main_text || p.description,
          secondaryText: p.structured_formatting?.secondary_text || "",
        }),
      );
      return { configured: true as const, suggestions };
    } catch {
      return { configured: true as const, suggestions: [] as PlaceSuggestion[], error: "Places request failed", allowManual: true };
    }
  });

export const placesDetails = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { placeId: string }) => guardInput(input))
  .handler(async ({ data }) => {
    if (!isPlacesConfigured()) return { ok: false as const, error: "Address search unavailable" };
    const placeId = data.placeId.trim();
    if (!placeId) return { ok: false as const, error: "placeId required" };
    const key = googleMapsApiKey()!;
    const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
    url.searchParams.set("place_id", placeId);
    url.searchParams.set("fields", "place_id,formatted_address,geometry,address_component");
    url.searchParams.set("key", key);
    try {
      const res = await fetch(url.toString());
      const body = await res.json();
      if (body.status !== "OK" || !body.result) {
        return { ok: false as const, error: body.status || "Details failed", allowManual: true };
      }
      const r = body.result;
      const lat = r.geometry?.location?.lat ?? null;
      const lng = r.geometry?.location?.lng ?? null;
      let timezone: string | null = null;
      if (typeof lat === "number" && typeof lng === "number") {
        try {
          const tzUrl = new URL("https://maps.googleapis.com/maps/api/timezone/json");
          tzUrl.searchParams.set("location", `${lat},${lng}`);
          tzUrl.searchParams.set("timestamp", String(Math.floor(Date.now() / 1000)));
          tzUrl.searchParams.set("key", key);
          const tzRes = await fetch(tzUrl.toString());
          const tzData = await tzRes.json();
          if (tzData.status === "OK" && isValidTimezone(tzData.timeZoneId)) timezone = tzData.timeZoneId;
        } catch {
          timezone = null;
        }
      }
      return {
        ok: true as const,
        placeId: r.place_id || placeId,
        formattedAddress: r.formatted_address || "",
        lat,
        lng,
        city: cityFromAddressComponents(r.address_components),
        timezone,
      };
    } catch {
      return { ok: false as const, error: "Details request failed", allowManual: true };
    }
  });

export const runReminderPass = createServerFn({ method: "POST" })
  .validator((input: { secret?: string } = {}) => guardInput(input))
  .handler(async ({ data }) => {
    const secret = process.env.CRON_SECRET;
    if (!secret || data?.secret !== secret) return { ok: false as const, error: "Unauthorized" };
    const sql = await getSql();
    return { ok: true as const, ...(await runReminders(sql)) };
  });

