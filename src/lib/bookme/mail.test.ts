import assert from "node:assert/strict";
import { changeMails, coachSwapRequestMail,
  newMessageMail, confirmationMails, manageLinkMail, productionMailConfigError, reminderMails, requestResolvedMail, sendMail, studentMessageMail, studentMoveRequestMails } from "./mail.ts";

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
assert.doesNotMatch(mails[0].text, /Pay cash|Card payment/);
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
assert.doesNotMatch(card[0].text, /Card payment|Pay cash/);

const again = confirmationMails({
  coachName: "Tim Zhang",
  coachEmail: "tim@bookme.test",
  studentName: "Emma Chen",
  studentEmail: "emma@test.com",
  when: "Fri",
  location: "Court 3",
  manageUrl: "https://bookme.training/manage?email=emma@test.com",
  bookAgainUrl: "https://bookme.training/tim",
});
assert.match(again[0].text, /Book another lesson: https:\/\/bookme\.training\/tim/);
assert.match(again[0].text, /\/manage\?email=/);
assert.doesNotMatch(again[1].text, /Book another lesson/);

const moved = changeMails({
  kind: "rescheduled",
  coachName: "Tim Zhang",
  coachEmail: "tim@bookme.test",
  studentName: "Emma",
  studentEmail: "emma@test.com",
  when: "Fri",
  nextWhen: "Sat 10:00",
  manageUrl: "https://bookme.training/manage?email=emma@test.com",
});
assert.equal(moved.length, 2);
assert.equal(moved[0].to, "emma@test.com");
assert.equal(moved[1].to, "tim@bookme.test");
assert.match(moved[0].text, /Fri/);
assert.match(moved[0].text, /Sat 10:00/);
assert.match(moved[0].text, /bookme\.training/);
assert.match(moved[1].text, /Sat 10:00/);

const cancelled = changeMails({
  kind: "cancelled",
  coachName: "Tim Zhang",
  coachEmail: "tim@bookme.test",
  studentName: "Emma",
  studentEmail: "emma@test.com",
  when: "Fri 10:00",
  manageUrl: "https://bookme.training/manage?email=emma@test.com",
});
assert.equal(cancelled.length, 2);
assert.equal(cancelled[0].to, "emma@test.com");
assert.equal(cancelled[1].to, "tim@bookme.test");
assert.match(cancelled[0].text, /Fri 10:00/);
assert.match(cancelled[1].text, /Fri 10:00/);

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
assert.match(nextCard[0].text, /next Fri/);

const r24 = reminderMails({
  kind: "24h",
  coachName: "Tim Zhang",
  coachEmail: "tim@bookme.test",
  studentName: "Emma",
  studentEmail: "emma@test.com",
  when: "Sat 10:00",
  location: "Court 3",
  manageUrl: "https://bookme.training/manage?email=emma@test.com",
});
assert.equal(r24.length, 2);
assert.equal(r24[0].to, "emma@test.com");
assert.equal(r24[1].to, "tim@bookme.test");
assert.match(r24[0].text, /tomorrow/);
assert.match(r24[0].text, /manage/i);
assert.match(r24[0].text, /bookme\.training/);

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

const asked = studentMoveRequestMails({
  coachName: "Alex Rivera",
  coachEmail: "coach@bookme.test",
  studentName: "Emma Chen",
  studentEmail: "emma@bookme.test",
  when: "Mon 10:00",
  nextWhen: "Tue 4:00",
  note: "School concert",
  inboxUrl: "https://bookme.training/app/bookings?tab=requests",
  manageUrl: "https://bookme.training/manage",
});
assert.equal(asked.length, 2);
assert.equal(asked[0].to, "coach@bookme.test");
assert.match(asked[0].text, /School concert/);
assert.match(asked[1].text, /Alex Rivera/);

const swapMail = coachSwapRequestMail({
  studentEmail: "emma@bookme.test",
  studentName: "Emma",
  coachName: "Alex Rivera",
  yourWhen: "Mon 10:00",
  otherWhen: "Tue 4:00",
  note: "Court conflict",
  decideUrl: "https://bookme.training/r/abc",
});
assert.equal(swapMail.to, "emma@bookme.test");
assert.match(swapMail.text, /another student's lesson/);
assert.doesNotMatch(swapMail.text, /Jordan/);
assert.match(swapMail.text, /Court conflict/);
assert.match(swapMail.text, /\/r\/abc/);

const notice = newMessageMail({ to: "emma@x.test", name: "Emma", fromName: "Alex Rivera", link: "https://bookme.training/manage/messages/c1" });
assert.equal(notice.to, "emma@x.test");
assert.match(notice.subject, /Alex Rivera/);
assert.match(notice.text, /manage\/messages\/c1/);
assert.doesNotMatch(notice.text, /Court conflict/);

const withdrawn = requestResolvedMail({
  studentEmail: "emma@bookme.test",
  studentName: "Emma",
  coachName: "Alex Rivera",
  kind: "withdrawn",
  summary: "Alex Rivera withdrew the proposed time swap. Your lesson stays as booked.",
  manageUrl: "https://bookme.training/manage",
});
assert.match(withdrawn.subject, /withdrawn/i);
assert.match(withdrawn.text, /stays as booked/);
assert.match(withdrawn.text, /manage/i);

async function withEnv(key: string, value: string | undefined, fn: () => Promise<void>) {
  const prev = process.env[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
  try {
    await fn();
  } finally {
    if (prev === undefined) delete process.env[key];
    else process.env[key] = prev;
  }
}

async function testSendMail() {
  const originalFetch = globalThis.fetch;
  const logs: string[] = [];
  const originalLog = console.log;
  console.log = (...args: unknown[]) => {
    logs.push(args.map(String).join(" "));
  };

  try {
    await withEnv("NODE_ENV", "development", async () => {
      await withEnv("RESEND_API_KEY", undefined, async () => {
        logs.length = 0;
        const result = await sendMail(
          { to: "emma@test.com", subject: "Hi", text: "Hello" },
          { bookingId: "b1", template: "confirm" },
        );
        assert.equal(result.ok, true);
        assert.ok(logs.some((line) => line.includes("[mail stub]")));
        assert.ok(logs.some((line) => line.includes("mail_stub") && line.includes("emma@test.com")));
      });
    });

    await withEnv("NODE_ENV", "production", async () => {
      await withEnv("RESEND_API_KEY", undefined, async () => {
        logs.length = 0;
        const missing = await sendMail(
          { to: "emma@test.com", subject: "Hi", text: "Hello" },
          { template: "student_code" },
        );
        assert.equal(missing.ok, false);
        if (!missing.ok) assert.match(missing.error, /RESEND_API_KEY/);
        assert.ok(logs.some((line) => line.includes("mail_not_configured") && line.includes("student_code")));
        assert.equal(productionMailConfigError(), "RESEND_API_KEY is not set");
      });
    });
    assert.equal(productionMailConfigError(), null);

    await withEnv("RESEND_API_KEY", "re_test", async () => {
      let sentBody = "";
      globalThis.fetch = (async (_input: unknown, init?: RequestInit) => {
        sentBody = String(init?.body || "");
        return new Response(JSON.stringify({ id: "email_1" }), { status: 200 });
      }) as typeof fetch;
      logs.length = 0;
      const ok = await sendMail(
        { to: "emma@test.com", subject: "Hi", text: "Hello" },
        { bookingId: "b2", template: "confirm" },
      );
      assert.equal(ok.ok, true);
      if (ok.ok) assert.equal(ok.id, "email_1");
      assert.match(sentBody, /"html":/);
      assert.match(sentBody, /Hello/);
      assert.ok(logs.some((line) => line.includes("mail_sent") && line.includes("email_1") && line.includes("confirm")));

      globalThis.fetch = (async () =>
        new Response("bad key", { status: 401 })) as typeof fetch;
      logs.length = 0;
      const bad = await sendMail(
        { to: "emma@test.com", subject: "Hi", text: "Hello" },
        { bookingId: "b3", template: "confirm" },
      );
      assert.equal(bad.ok, false);
      if (!bad.ok) assert.match(bad.error, /401/);
      assert.ok(logs.some((line) => line.includes("mail_send_failed") && line.includes("b3")));

      globalThis.fetch = (async () =>
        new Response("boom", { status: 500 })) as typeof fetch;
      const serverErr = await sendMail(
        { to: "tim@bookme.test", subject: "Hi", text: "Hello" },
        { template: "reminder_24h" },
      );
      assert.equal(serverErr.ok, false);

      globalThis.fetch = (async () => {
        throw new Error("network down");
      }) as typeof fetch;
      logs.length = 0;
      const net = await sendMail(
        { to: "emma@test.com", subject: "Hi", text: "Hello" },
        { bookingId: "b4", template: "cancelled" },
      );
      assert.equal(net.ok, false);
      if (!net.ok) assert.match(net.error, /network down/);
      assert.ok(logs.some((line) => line.includes("mail_send_failed") && line.includes("b4")));
    });
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
  }
}

testSendMail()
  .then(() => console.log("mail tests ok"))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
