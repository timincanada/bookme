/**
 * Coach, student, and public venue forecast, plus weather_ask open / keep / cancel.
 * Cancel calls applyCancelLesson — the same refund and student email as a normal coach cancel.
 */
import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { applyCancelLesson, coachForUser } from "./api";
import { normalizeEmail } from "./email";
import { guardInput } from "./input-guard";
import {
  openAskAsStudent,
  resolveAskAsCoach,
  weatherForCoach,
  weatherForStudent,
  weatherForVenue,
  weatherSnippetForLesson,
} from "./weather-service";

const currentStudent = async () => (await import("./student-session.server")).currentStudent();

export const coachWeather = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const coach = await coachForUser(sql, context.userId);
    if (!coach) return { ok: false as const, error: "Sign in required", lessons: [] };
    return { ok: true as const, lessons: await weatherForCoach(sql, coach.id) };
  });

export const studentWeather = createServerFn({ method: "GET" }).handler(async () => {
  const me = await currentStudent();
  if (!me) return { ok: false as const, error: "Verify your email first", lessons: [] };
  const sql = await getSql();
  return { ok: true as const, lessons: await weatherForStudent(sql, normalizeEmail(me.email)) };
});

export const publicVenueWeather = createServerFn({ method: "GET" })
  .validator((input: { slug: string; locationId?: string; start: string; durationMin?: number }) => guardInput(input))
  .handler(async ({ data }) => {
    try {
      const sql = await getSql();
      const weather = await weatherForVenue(sql, {
        slug: String(data.slug || ""),
        locationId: data.locationId,
        start: String(data.start || ""),
        durationMin: data.durationMin,
      });
      return { ok: true as const, weather };
    } catch (err) {
      console.error(JSON.stringify({ msg: "public_weather_failed", error: String(err) }));
      return { ok: true as const, weather: null };
    }
  });

export const studentOpenWeatherAsk = createServerFn({ method: "POST" })
  .validator((input: { lessonId: string }) => guardInput(input))
  .handler(async ({ data }) => {
    const me = await currentStudent();
    if (!me) return { ok: false as const, error: "Verify your email first" };
    const sql = await getSql();
    return openAskAsStudent(sql, normalizeEmail(me.email), String(data.lessonId || ""));
  });

export const coachResolveWeather = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { lessonId: string; decision: "keep" | "cancel" }) => guardInput(input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const coach = await coachForUser(sql, context.userId);
    if (!coach) return { ok: false as const, error: "Sign in required" };
    return resolveAskAsCoach(sql, coach, String(data.lessonId || ""), data.decision, {
      cancelLesson: (tx, _who, lessonId) => applyCancelLesson(tx, coach, lessonId),
    });
  });

export const coachThreadWeather = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { lessonId: string }) => guardInput(input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const coach = await coachForUser(sql, context.userId);
    if (!coach) return { ok: false as const, error: "Sign in required", weather: null };
    const rows = await sql.query<{ id: string }>(
      `select id from lessons where id = $1 and coach_id = $2`,
      [String(data.lessonId || ""), coach.id],
    );
    if (!rows[0]) return { ok: true as const, weather: null };
    return { ok: true as const, weather: await weatherSnippetForLesson(sql, rows[0].id) };
  });

export const studentThreadWeather = createServerFn({ method: "GET" })
  .validator((input: { lessonId: string }) => guardInput(input))
  .handler(async ({ data }) => {
    const me = await currentStudent();
    if (!me) return { ok: false as const, error: "Verify your email first", weather: null };
    const sql = await getSql();
    const rows = await sql.query<{ id: string }>(
      `select l.id from lessons l join clients cl on cl.id = l.client_id
       where l.id = $1 and lower(cl.email) = $2`,
      [String(data.lessonId || ""), normalizeEmail(me.email)],
    );
    if (!rows[0]) return { ok: true as const, weather: null };
    return { ok: true as const, weather: await weatherSnippetForLesson(sql, rows[0].id) };
  });
