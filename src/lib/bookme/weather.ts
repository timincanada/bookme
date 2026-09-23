/**
 * Venue forecast rules. Thresholds are server constants (v1 defaults).
 * Open-Meteo is fetched elsewhere; this module only judges a set of hours.
 */

export const WEATHER_WINDOW_MS = 72 * 60 * 60 * 1000;
export const FORECAST_CACHE_MS = 45 * 60 * 1000;
export const WEATHER_HEADLINE = "Forecast may affect an outdoor lesson";

export const WEATHER_THRESHOLDS = {
  precipProbability: 70,
  precipMm: 5,
  gustKmh: 60,
  windKmh: 50,
  coldC: -15,
  hotC: 35,
  thunderMin: 95,
  thunderMax: 99,
} as const;

export type WeatherSignalCode = "precip" | "wind" | "temperature" | "thunder";

export type WeatherSignal = {
  code: WeatherSignalCode;
  detail: string;
  /** Set for temperature breaches so the chip can pick a cold vs hot icon. */
  kind?: "cold" | "hot";
};

export type WeatherIconName = "cloud-sun" | "rain" | "thunder" | "wind" | "snow";

export type HourPoint = {
  /** Unix ms at the start of the hour. */
  time: number;
  temperature: number | null;
  apparent: number | null;
  precipProbability: number | null;
  precipitation: number | null;
  wind: number | null;
  gust: number | null;
  weatherCode: number | null;
};

const HOUR_MS = 60 * 60 * 1000;
const SIGNAL_ORDER: WeatherSignalCode[] = ["thunder", "precip", "wind", "temperature"];

export function isOnlineKind(kind: string | null | undefined) {
  return (kind || "").trim().toLowerCase() === "online";
}

export function validCoords(lat: unknown, lng: unknown): { lat: number; lng: number } | null {
  const la = typeof lat === "number" ? lat : typeof lat === "string" && lat.trim() ? Number(lat) : NaN;
  const ln = typeof lng === "number" ? lng : typeof lng === "string" && lng.trim() ? Number(lng) : NaN;
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;
  if (la < -90 || la > 90 || ln < -180 || ln > 180) return null;
  return { lat: la, lng: ln };
}

/** Upcoming confirmed lessons only: start is now through 72h, inclusive. */
export function isUpcomingWithinWindow(start: Date, now: Date, windowMs = WEATHER_WINDOW_MS) {
  const delta = start.getTime() - now.getTime();
  return delta >= 0 && delta <= windowMs;
}

/** Hours whose [T, T+1h) overlaps the lesson widened by one hour on each side. */
export function hoursOverlapping(points: HourPoint[], start: Date, end: Date): HourPoint[] {
  const from = start.getTime() - HOUR_MS;
  const to = end.getTime() + HOUR_MS;
  return points.filter((p) => p.time < to && p.time + HOUR_MS > from);
}

export function forecastCacheKey(lat: number, lng: number, now: Date) {
  const latR = Math.round(lat * 1000) / 1000;
  const lngR = Math.round(lng * 1000) / 1000;
  const hour = new Date(now);
  hour.setUTCMinutes(0, 0, 0);
  return `${latR.toFixed(3)},${lngR.toFixed(3)},${hour.toISOString()}`;
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function parseTime(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value < 1e12 ? value * 1000 : value;
  }
  if (typeof value !== "string" || !value.trim()) return null;
  const trimmed = value.trim();
  const iso = /Z$|[+-]\d{2}:?\d{2}$/.test(trimmed) ? trimmed : `${trimmed}Z`;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

/** Accepts an Open-Meteo forecast body (unixtime or ISO hourly.time). */
export function parseOpenMeteo(body: unknown): HourPoint[] {
  if (!body || typeof body !== "object") return [];
  const hourly = (body as { hourly?: unknown }).hourly;
  if (!hourly || typeof hourly !== "object") return [];
  const h = hourly as Record<string, unknown>;
  const times = Array.isArray(h.time) ? h.time : [];
  const col = (key: string) => (Array.isArray(h[key]) ? (h[key] as unknown[]) : []);
  const temperature = col("temperature_2m");
  const apparent = col("apparent_temperature");
  const pop = col("precipitation_probability");
  const precipitation = col("precipitation");
  const wind = col("wind_speed_10m");
  const gust = col("wind_gusts_10m");
  const code = col("weather_code");
  const points: HourPoint[] = [];
  for (let i = 0; i < times.length; i++) {
    const time = parseTime(times[i]);
    if (time == null) continue;
    points.push({
      time,
      temperature: num(temperature[i]),
      apparent: num(apparent[i]),
      precipProbability: num(pop[i]),
      precipitation: num(precipitation[i]),
      wind: num(wind[i]),
      gust: num(gust[i]),
      weatherCode: num(code[i]),
    });
  }
  return points;
}

function mmText(n: number) {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function isThunderCode(code: number | null) {
  return code != null && code >= WEATHER_THRESHOLDS.thunderMin && code <= WEATHER_THRESHOLDS.thunderMax;
}

function isSnowCode(code: number | null) {
  if (code == null) return false;
  return (code >= 71 && code <= 77) || code === 85 || code === 86;
}

function isRainCode(code: number | null) {
  if (code == null) return false;
  return (code >= 51 && code <= 67) || (code >= 80 && code <= 82);
}

export function signalsFor(points: HourPoint[]): WeatherSignal[] {
  const signals: WeatherSignal[] = [];
  let maxPop = -Infinity;
  let maxMm = -Infinity;
  let maxGust = -Infinity;
  let maxWind = -Infinity;
  let cold: { v: number; feels: boolean } | null = null;
  let hot: { v: number; feels: boolean } | null = null;
  let thunder = false;
  for (const p of points) {
    if (p.precipProbability != null) maxPop = Math.max(maxPop, p.precipProbability);
    if (p.precipitation != null) maxMm = Math.max(maxMm, p.precipitation);
    if (p.gust != null) maxGust = Math.max(maxGust, p.gust);
    if (p.wind != null) maxWind = Math.max(maxWind, p.wind);
    if (isThunderCode(p.weatherCode)) thunder = true;
    const readings: Array<{ v: number; feels: boolean }> = [];
    if (p.apparent != null) readings.push({ v: p.apparent, feels: true });
    if (p.temperature != null) readings.push({ v: p.temperature, feels: false });
    for (const r of readings) {
      if (r.v <= WEATHER_THRESHOLDS.coldC && (!cold || r.v < cold.v)) cold = r;
      if (r.v >= WEATHER_THRESHOLDS.hotC && (!hot || r.v > hot.v)) hot = r;
    }
  }
  if (maxPop >= WEATHER_THRESHOLDS.precipProbability || maxMm >= WEATHER_THRESHOLDS.precipMm) {
    const bits: string[] = [];
    if (maxPop >= WEATHER_THRESHOLDS.precipProbability) bits.push(`Rain likely (${Math.round(maxPop)}%)`);
    if (maxMm >= WEATHER_THRESHOLDS.precipMm) bits.push(`${mmText(maxMm)} mm/h rain`);
    signals.push({ code: "precip", detail: bits.join(", ") });
  }
  if (maxGust >= WEATHER_THRESHOLDS.gustKmh || maxWind >= WEATHER_THRESHOLDS.windKmh) {
    const detail =
      maxGust >= WEATHER_THRESHOLDS.gustKmh
        ? `Gusts ${Math.round(maxGust)} km/h`
        : `Wind ${Math.round(maxWind)} km/h`;
    signals.push({ code: "wind", detail });
  }
  if (cold || hot) {
    const bits: string[] = [];
    const label = (r: { v: number; feels: boolean }) =>
      `${r.feels ? "Feels like" : "Temperature"} ${Math.round(r.v)}°C`;
    if (cold) bits.push(label(cold));
    if (hot) bits.push(label(hot));
    signals.push({
      code: "temperature",
      detail: bits.join(", "),
      kind: cold ? "cold" : "hot",
    });
  }
  if (thunder) signals.push({ code: "thunder", detail: "Thunderstorm in the forecast" });
  return signals.sort((a, b) => SIGNAL_ORDER.indexOf(a.code) - SIGNAL_ORDER.indexOf(b.code));
}

export function primarySignal(signals: WeatherSignal[]): WeatherSignal | null {
  return signals[0] ?? null;
}

export function iconFor(signals: WeatherSignal[], points: HourPoint[]): WeatherIconName {
  const primary = primarySignal(signals);
  if (primary?.code === "thunder") return "thunder";
  if (primary?.code === "precip") return points.some((p) => isSnowCode(p.weatherCode)) ? "snow" : "rain";
  if (primary?.code === "wind") return "wind";
  if (primary?.code === "temperature") return primary.kind === "cold" ? "snow" : "cloud-sun";
  if (points.some((p) => isThunderCode(p.weatherCode))) return "thunder";
  if (points.some((p) => isSnowCode(p.weatherCode))) return "snow";
  if (points.some((p) => isRainCode(p.weatherCode))) return "rain";
  return "cloud-sun";
}

/** `22° / 14° · 40%` — high / low, then rain probability when we have it. */
export function formatChipSummary(points: HourPoint[]): string | null {
  const temps = points.map((p) => p.temperature).filter((t): t is number => t != null);
  if (!temps.length) return null;
  const high = Math.round(Math.max(...temps));
  const low = Math.round(Math.min(...temps));
  const tempText = high === low ? `${high}°` : `${high}° / ${low}°`;
  const pops = points.map((p) => p.precipProbability).filter((t): t is number => t != null);
  if (!pops.length) return tempText;
  return `${tempText} · ${Math.round(Math.max(...pops))}%`;
}

export type ForecastRead = {
  summary: string;
  icon: WeatherIconName;
  extreme: boolean;
  signals: WeatherSignal[];
  headline: string | null;
  signal: string | null;
};

export function readForecast(points: HourPoint[]): ForecastRead | null {
  const summary = formatChipSummary(points);
  if (!summary) return null;
  const signals = signalsFor(points);
  const signal = primarySignal(signals)?.detail ?? null;
  return {
    summary,
    icon: iconFor(signals, points),
    extreme: signals.length > 0,
    signals,
    headline: signals.length ? WEATHER_HEADLINE : null,
    signal,
  };
}

export function weatherAskMail(input: {
  coachEmail: string;
  studentName: string;
  when: string;
  place: string;
  signal: string;
  lessonUrl: string;
}): { to: string; subject: string; text: string } {
  const signal = input.signal || "the forecast";
  return {
    to: input.coachEmail,
    subject: `Weather check: ${input.studentName}`,
    text: `${input.studentName} asked you to decide whether to keep or cancel the lesson on ${input.when} at ${input.place}. Forecast may affect an outdoor lesson (${signal}). Decide here: ${input.lessonUrl}`,
  };
}
