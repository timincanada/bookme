import assert from "node:assert/strict";
import {
  WEATHER_HEADLINE,
  WEATHER_THRESHOLDS,
  forecastCacheKey,
  formatChipSummary,
  hoursOverlapping,
  iconFor,
  isOnlineKind,
  isUpcomingWithinWindow,
  parseOpenMeteo,
  readForecast,
  signalsFor,
  validCoords,
  weatherAskMail,
  type HourPoint,
} from "./weather.ts";

const HOUR = 60 * 60 * 1000;
const START = new Date("2031-06-02T15:00:00Z");
const END = new Date(START.getTime() + HOUR);

function point(offsetHours: number, patch: Partial<HourPoint> = {}): HourPoint {
  return {
    time: START.getTime() + offsetHours * HOUR,
    temperature: 18,
    apparent: 17,
    precipProbability: 10,
    precipitation: 0,
    wind: 12,
    gust: 20,
    weatherCode: 1,
    ...patch,
  };
}

function at(iso: string, patch: Partial<HourPoint> = {}): HourPoint {
  return { ...point(0), time: Date.parse(iso), ...patch };
}

assert.equal(isOnlineKind("online"), true);
assert.equal(isOnlineKind(" Online "), true);
assert.equal(isOnlineKind("in_person"), false);
assert.equal(isOnlineKind(null), false);

assert.deepEqual(validCoords(43.8, -79.3), { lat: 43.8, lng: -79.3 });
assert.deepEqual(validCoords("43.8", "-79.3"), { lat: 43.8, lng: -79.3 });
assert.equal(validCoords(0, 0)?.lat, 0);
assert.equal(validCoords(null, 1), null);
assert.equal(validCoords(91, 0), null);
assert.equal(validCoords(0, 181), null);

{
  const now = new Date("2031-06-01T15:00:00Z");
  assert.equal(isUpcomingWithinWindow(now, now), true);
  assert.equal(isUpcomingWithinWindow(new Date(now.getTime() + 72 * HOUR), now), true);
  assert.equal(isUpcomingWithinWindow(new Date(now.getTime() + 72 * HOUR + 1), now), false);
  assert.equal(isUpcomingWithinWindow(new Date(now.getTime() - 1), now), false);
}

{
  const points = [
    at("2031-06-02T13:00:00Z", { precipProbability: 90 }),
    at("2031-06-02T14:00:00Z", { precipProbability: 20 }),
    at("2031-06-02T16:00:00Z", { precipProbability: 30 }),
    at("2031-06-02T17:00:00Z", { precipProbability: 99 }),
  ];
  const hit = hoursOverlapping(points, START, END).map((p) => new Date(p.time).toISOString());
  assert.deepEqual(hit, ["2031-06-02T14:00:00.000Z", "2031-06-02T16:00:00.000Z"]);
}

{
  const mild = [point(0)];
  assert.deepEqual(signalsFor(mild), []);
  assert.equal(signalsFor([point(0, { precipProbability: 69.9 })]).length, 0);
  assert.equal(signalsFor([point(0, { precipProbability: 70 })])[0]?.code, "precip");
  assert.equal(signalsFor([point(0, { precipitation: 4.9 })]).length, 0);
  assert.match(signalsFor([point(0, { precipitation: 5 })])[0]?.detail || "", /5 mm\/h/);
  assert.equal(signalsFor([point(0, { gust: 59.9, wind: 49.9 })]).length, 0);
  assert.match(signalsFor([point(0, { gust: 60 })])[0]?.detail || "", /Gusts 60/);
  assert.match(signalsFor([point(0, { gust: 40, wind: 50 })])[0]?.detail || "", /Wind 50/);
  assert.equal(signalsFor([point(0, { apparent: -14.9, temperature: -14 })]).length, 0);
  assert.equal(signalsFor([point(0, { apparent: -15 })])[0]?.kind, "cold");
  assert.equal(signalsFor([point(0, { apparent: 34, temperature: 34.9 })]).length, 0);
  assert.equal(signalsFor([point(0, { temperature: 35, apparent: 20 })])[0]?.kind, "hot");
  assert.match(signalsFor([point(0, { temperature: 35, apparent: 20 })])[0]?.detail || "", /Temperature 35/);
  assert.match(signalsFor([point(0, { apparent: 36, temperature: 30 })])[0]?.detail || "", /Feels like 36/);
  assert.equal(signalsFor([point(0, { weatherCode: 94 })]).length, 0);
  assert.equal(signalsFor([point(0, { weatherCode: 95 })])[0]?.code, "thunder");
  assert.equal(signalsFor([point(0, { weatherCode: 99 })])[0]?.code, "thunder");
  assert.equal(signalsFor([point(0, { weatherCode: 100 })]).length, 0);
}

{
  const both = signalsFor([
    point(0, { precipProbability: 80, gust: 70, apparent: -16, weatherCode: 95 }),
  ]);
  assert.deepEqual(
    both.map((s) => s.code),
    ["thunder", "precip", "wind", "temperature"],
  );
  const read = readForecast([
    point(0, { temperature: 22, precipProbability: 40 }),
    point(1, { temperature: 14, precipProbability: 10 }),
  ]);
  assert.equal(read?.summary, "22° / 14° · 40%");
  assert.equal(read?.extreme, false);
  assert.equal(read?.icon, "cloud-sun");
  assert.equal(read?.headline, null);
}

{
  const extreme = readForecast([point(0, { temperature: 22, precipProbability: 80, weatherCode: 95 })]);
  assert.equal(extreme?.extreme, true);
  assert.equal(extreme?.headline, WEATHER_HEADLINE);
  assert.equal(extreme?.signal, "Thunderstorm in the forecast");
  assert.equal(extreme?.icon, "thunder");
  assert.equal(iconFor([{ code: "precip", detail: "Rain likely (80%)" }], [point(0, { weatherCode: 71 })]), "snow");
  assert.equal(iconFor([{ code: "wind", detail: "Gusts 60 km/h" }], [point(0)]), "wind");
  assert.equal(iconFor([], [point(0, { weatherCode: 61 })]), "rain");
  assert.equal(iconFor([], [point(0, { weatherCode: 73 })]), "snow");
}

assert.equal(formatChipSummary([point(0, { temperature: 18, precipProbability: 0 })]), "18° · 0%");
assert.equal(formatChipSummary([point(0, { temperature: null, precipProbability: 90 })]), null);

{
  const parsed = parseOpenMeteo({
    hourly: {
      time: [Math.floor(START.getTime() / 1000), "2031-06-02T16:00"],
      temperature_2m: [22, "14"],
      apparent_temperature: [21, 13],
      precipitation_probability: [40, 70],
      precipitation: [0, 5],
      wind_speed_10m: [10, 20],
      wind_gusts_10m: [15, 61],
      weather_code: [1, 95],
    },
  });
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0]?.time, START.getTime());
  assert.equal(parsed[1]?.temperature, 14);
  assert.equal(parsed[1]?.weatherCode, 95);
  assert.equal(parseOpenMeteo(null).length, 0);
  assert.equal(parseOpenMeteo({ hourly: { time: ["nope"] } }).length, 0);
}

{
  const now = new Date("2031-06-01T15:20:00Z");
  const later = new Date("2031-06-01T15:50:00Z");
  assert.equal(forecastCacheKey(43.8532, -79.301, now), forecastCacheKey(43.8534, -79.3006, later));
  assert.notEqual(forecastCacheKey(43.85, -79.3, now), forecastCacheKey(43.85, -79.3, new Date("2031-06-01T16:00:00Z")));
}

{
  const mail = weatherAskMail({
    coachEmail: "dan@x.test",
    studentName: "Emma Chen",
    when: "Tue 3:00 p.m.",
    place: "Mayfair Parkway",
    signal: "Gusts 64 km/h",
    lessonUrl: "https://bookme.training/app/lessons/abc",
  });
  assert.equal(mail.to, "dan@x.test");
  assert.match(mail.subject, /Emma Chen/);
  assert.match(mail.text, /Forecast may affect an outdoor lesson/);
  assert.match(mail.text, /Gusts 64 km\/h/);
  assert.match(mail.text, /keep or cancel/);
}

assert.equal(WEATHER_THRESHOLDS.precipProbability, 70);
assert.equal(WEATHER_THRESHOLDS.precipMm, 5);
assert.equal(WEATHER_THRESHOLDS.gustKmh, 60);
assert.equal(WEATHER_THRESHOLDS.windKmh, 50);
assert.equal(WEATHER_THRESHOLDS.coldC, -15);
assert.equal(WEATHER_THRESHOLDS.hotC, 35);

console.log("weather tests ok");
