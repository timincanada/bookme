import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../../routes/app.tsx", import.meta.url), "utf8");
const tabs = readFileSync(
  new URL("../../components/bookme/app-tab-bar.tsx", import.meta.url),
  "utf8",
);
const more = readFileSync(new URL("../../routes/app/more.tsx", import.meta.url), "utf8");
const cards = readFileSync(
  new URL("../../components/bookme/thread-context-cards.tsx", import.meta.url),
  "utf8",
);
const inbox = readFileSync(new URL("../../routes/app/messages.index.tsx", import.meta.url), "utf8");

function labels(src: string) {
  return [...src.matchAll(/label: "([^"]+)"/g)].map((m) => m[1]);
}

const order = ["Schedule", "Bookings", "Messages", "Clients", "Assistant", "More"];
assert.deepEqual(labels(app), order);
assert.deepEqual(labels(tabs), order);

assert.match(app, /MessageCircle/);
assert.match(tabs, /MessageCircle/);
assert.doesNotMatch(app, /\bMail\b/);
assert.doesNotMatch(tabs, /\bMail\b/);

assert.match(app, /item\.to === "\/app\/messages"/);
assert.doesNotMatch(app, /item\.to === "\/app\/more" \? coach\?\.unreadMessages/);

const moreBlock = tabs.slice(tabs.indexOf('to: "/app/more"'), tabs.indexOf("] as const"));
assert.doesNotMatch(moreBlock, /messages/);
assert.match(tabs, /label: "Messages"[\s\S]*?startsWith\("\/app\/messages"\)/);
assert.match(tabs, /item\.to === "\/app\/messages" && unread/);
assert.doesNotMatch(tabs, /item\.to === "\/app\/more" && unread/);
assert.match(tabs, /bg-forest/);
assert.match(tabs, /text-on-forest/);
assert.match(tabs, /9\+/);

assert.doesNotMatch(more, /\/app\/messages/);
assert.doesNotMatch(inbox, /to="\/app\/more"/);

assert.match(cards, /Swap pending/);
assert.match(cards, /Next booking/);
assert.match(cards, /Review in Bookings/);
assert.match(cards, /No upcoming booking with this client\./);
assert.match(cards, /bg-amber-50/);
assert.match(cards, /border-l-amber-500/);
assert.match(cards, /#10B981/);
assert.match(cards, /tab: "requests"/);
