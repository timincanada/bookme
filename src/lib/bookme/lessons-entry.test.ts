import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const more = readFileSync(new URL("../../routes/app/more.tsx", import.meta.url), "utf8");
const lessons = readFileSync(new URL("../../routes/app/more.lessons.tsx", import.meta.url), "utf8");
const share = readFileSync(new URL("../../components/bookme/booking-share.tsx", import.meta.url), "utf8");
const setup = readFileSync(new URL("../../routes/app/setup.tsx", import.meta.url), "utf8");
const tabs = readFileSync(new URL("../../components/bookme/app-tab-bar.tsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../../routes/app.tsx", import.meta.url), "utf8");
const api = readFileSync(new URL("./api.ts", import.meta.url), "utf8");

const menu = more.slice(more.indexOf("["), more.indexOf("].map"));
const locationsAt = menu.indexOf('"Locations"');
const lessonsAt = menu.indexOf('"Lessons"');
const paymentsAt = menu.indexOf('"Payments"');
assert.ok(locationsAt !== -1 && lessonsAt !== -1 && paymentsAt !== -1, "More menu labels");
assert.ok(locationsAt < lessonsAt && lessonsAt < paymentsAt, "Lessons sits under Locations and above Payments");
assert.match(menu, /\/app\/more\/lessons/);
assert.doesNotMatch(menu, /Offerings|Products|Services/);

assert.match(lessons, /createFileRoute\("\/app\/more\/lessons"\)/);
assert.match(lessons, />Lessons</);
assert.match(lessons, /Duration and price for each lesson length\./);
assert.match(lessons, /No lessons yet\./);
assert.match(lessons, />Set up lessons</);
assert.match(lessons, /to="\/app\/setup"/);
assert.match(lessons, /saveCoachLesson/);
assert.doesNotMatch(lessons, /saveCoachBasics/);

assert.match(more, /Your booking link/);
assert.match(more, /Students use this to book a new lesson\./);
assert.match(more, /Student desk/);
assert.match(more, /For students who already booked — move a lesson or message you\. Not for new bookings\./);
assert.match(more, /Copy desk link/);
assert.doesNotMatch(more, /Copy manage link/);
assert.doesNotMatch(more, /Booking page/);

assert.match(setup, /Your booking link/);
assert.match(setup, /Students use this to book a new lesson\./);
assert.match(share, /Copy link/);
assert.match(share, /\n\s+Share\n/);
assert.doesNotMatch(share, /Copy short link/);
assert.doesNotMatch(share, /\/manage/);

const navLabels = [...app.matchAll(/label: "([^"]+)"/g)].map((m) => m[1]);
assert.deepEqual(navLabels, ["Schedule", "Bookings", "Messages", "Clients", "Assistant", "More"]);
assert.deepEqual([...tabs.matchAll(/label: "([^"]+)"/g)].map((m) => m[1]), navLabels);

const saveFn = api.slice(api.indexOf("export const saveCoachLesson"), api.indexOf("export const saveCoachLocations"));
assert.match(saveFn, /update services set duration/);
assert.match(saveFn, /where id = \$4 and coach_id = \$5/);
assert.doesNotMatch(saveFn, /update coaches|update locations|update weekly_hours|set name =/);

const BOOK_NEW = /book a new lesson|book another lesson|book again/gi;
const srcRoot = new URL("../../", import.meta.url);

function walk(dir: string, out: string[] = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "routeTree.gen.ts") continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      walk(path, out);
      continue;
    }
    if (/\.(ts|tsx)$/.test(name) && !name.endsWith(".test.ts")) out.push(path);
  }
  return out;
}

for (const file of walk(srcRoot.pathname)) {
  const text = readFileSync(file, "utf8");
  BOOK_NEW.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = BOOK_NEW.exec(text))) {
    const before = text.slice(Math.max(0, match.index - 250), match.index);
    const after = text.slice(match.index, match.index + 140);
    const desk =
      /to=["']\/manage["']/.test(before) ||
      /path:\s*["'`]\/manage["'`]/.test(before) ||
      /path:\s*["'`]\/manage["'`]/.test(after) ||
      /to=["']\/manage["']/.test(after);
    assert.equal(desk, false, `${file} book-new CTA must not point at /manage (${match[0]})`);
  }
}

console.log("lessons-entry tests ok");
