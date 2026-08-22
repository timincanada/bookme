import assert from "node:assert/strict";
import { changeMails, confirmationMails, manageLinkMail, reminderMails, studentMessageMail } from "./mail";

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


const r24 = reminderMails({
  kind: "24h",
  coachName: "Tim Zhang",
  coachEmail: "tim@bookme.test",
  studentName: "Emma",
  studentEmail: "emma@test.com",
  when: "Sat 10:00",
  location: "Court 3",
  manageUrl: "https://bookme.test/manage?email=emma@test.com",
});
assert.equal(r24.length, 2);
assert.equal(r24[0].to, "emma@test.com");
assert.equal(r24[1].to, "tim@bookme.test");
assert.match(r24[0].text, /tomorrow/);
assert.match(r24[0].text, /manage/i);

const r2 = reminderMails({
  kind: "2h",
  coachName: "Tim Zhang",
  coachEmail: "tim@bookme.test",
  studentName: "Emma",
  studentEmail: "emma@test.com",
  when: "Sat 10:00",
  location: "Court 3",
});
assert.match(r2[0].subject, /2 hours/);


const link = manageLinkMail({
  email: "emma@test.com",
  link: "https://bookme.test/manage?token=abc",
  code: "123456",
});
assert.equal(link.to, "emma@test.com");
assert.match(link.text, /one-time/i);
assert.match(link.text, /123456/);
assert.match(link.text, /token=abc/);

const note = studentMessageMail({ studentEmail: "emma@test.com", studentName: "Emma", coachName: "Tim Zhang", body: "Practice serve." });
assert.equal(note.to, "emma@test.com");
assert.match(note.subject, /Tim Zhang/);
assert.match(note.text, /Practice serve/);

console.log("mail tests ok");
