import assert from "node:assert/strict";
import { changeMails, confirmationMails } from "./mail";

const mails = confirmationMails({
  coachName: "Tim Zhang",
  coachEmail: "tim@bookme.test",
  studentName: "Emma Chen",
  studentEmail: "emma@test.com",
  when: "Fri, Aug 21, 10:00 a.m.",
  location: "Court 3",
  method: "cash",
});
assert.equal(mails.length, 2);
assert.equal(mails[0].to, "emma@test.com");
assert.equal(mails[1].to, "tim@bookme.test");
assert.match(mails[0].subject, /Tim Zhang/);
assert.match(mails[0].text, /Pay cash on arrival/);
assert.match(mails[1].text, /Emma Chen/);

const card = confirmationMails({
  coachName: "Tim Zhang",
  coachEmail: "tim@bookme.test",
  studentName: "Alex",
  studentEmail: "alex@test.com",
  when: "Sat",
  location: "Mayfair",
  method: "card",
});
assert.match(card[0].text, /Card payment received/);


const moved = changeMails({
  kind: "rescheduled",
  coachName: "Tim Zhang",
  coachEmail: "tim@bookme.test",
  studentName: "Emma",
  studentEmail: "emma@test.com",
  when: "Fri",
  nextWhen: "Sat 10:00",
});
assert.equal(moved[0].to, "emma@test.com");
assert.match(moved[0].text, /Sat 10:00/);

const nextCard = changeMails({
  kind: "next_week_card",
  coachName: "Tim Zhang",
  coachEmail: "tim@bookme.test",
  studentName: "Emma",
  studentEmail: "emma@test.com",
  when: "Fri",
  nextWhen: "next Fri",
  payUrl: "https://pay.test",
});
assert.match(nextCard[0].text, /https:\/\/pay.test/);

console.log("mail tests ok");
