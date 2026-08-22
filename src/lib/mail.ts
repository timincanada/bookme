export type Mail = { to: string; subject: string; text: string };

export function confirmationMails(input: {
  coachName: string;
  coachEmail: string;
  studentName: string;
  studentEmail: string;
  when: string;
  location: string;
  method: "cash" | "card" | string;
  manageUrl?: string;
}): Mail[] {
  const pay = input.method === "cash" ? "Pay cash on arrival." : "Card payment received.";
  const manage = input.manageUrl ? ` Manage: ${input.manageUrl}` : "";
  return [
    {
      to: input.studentEmail,
      subject: `Booked with ${input.coachName}`,
      text: `Hi ${input.studentName}, your private lesson with ${input.coachName} is confirmed for ${input.when} at ${input.location}. ${pay}${manage}`,
    },
    {
      to: input.coachEmail,
      subject: `New lesson: ${input.studentName}`,
      text: `${input.studentName} booked a private lesson on ${input.when} at ${input.location}. ${pay}`,
    },
  ];
}

export async function sendMail(mail: Mail) {
  if (process.env.RESEND_API_KEY) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.MAIL_FROM || "BookMe <noreply@bookme.test>",
        to: [mail.to],
        subject: mail.subject,
        text: mail.text,
      }),
    });
    return;
  }
  console.log("[mail stub]", mail.to, mail.subject, mail.text);
}

export async function sendLessonConfirmations(input: Parameters<typeof confirmationMails>[0]) {
  for (const mail of confirmationMails(input)) {
    await sendMail(mail);
  }
}


export function changeMails(input: {
  kind: "rescheduled" | "cancelled" | "next_week_cash" | "next_week_card";
  coachName: string;
  coachEmail: string;
  studentName: string;
  studentEmail: string;
  when: string;
  nextWhen?: string;
  payUrl?: string;
}): Mail[] {
  if (input.kind === "rescheduled") {
    return [
      {
        to: input.studentEmail,
        subject: `Lesson moved with ${input.coachName}`,
        text: `Hi ${input.studentName}, your lesson with ${input.coachName} moved to ${input.nextWhen}. Same price, no extra charge.`,
      },
    ];
  }
  if (input.kind === "cancelled") {
    return [
      {
        to: input.studentEmail,
        subject: `Lesson cancelled with ${input.coachName}`,
        text: `Hi ${input.studentName}, ${input.coachName} cancelled your lesson on ${input.when}. If you paid by card, the refund is on the way.`,
      },
    ];
  }
  if (input.kind === "next_week_cash") {
    return [
      {
        to: input.studentEmail,
        subject: `Booked next week with ${input.coachName}`,
        text: `Hi ${input.studentName}, ${input.coachName} booked you for ${input.nextWhen}. Pay cash on arrival.`,
      },
      {
        to: input.coachEmail,
        subject: `Next week booked: ${input.studentName}`,
        text: `${input.studentName} is booked for ${input.nextWhen}. Cash, unpaid.`,
      },
    ];
  }
  return [
    {
      to: input.studentEmail,
      subject: `Pay to confirm next week with ${input.coachName}`,
      text: `Hi ${input.studentName}, ${input.coachName} offered ${input.nextWhen}. Pay to confirm: ${input.payUrl || ""}`,
    },
  ];
}


export function reminderMails(input: {
  kind: "24h" | "2h";
  coachName: string;
  coachEmail: string;
  studentName: string;
  studentEmail: string;
  when: string;
  location: string;
  manageUrl?: string;
}): Mail[] {
  const label = input.kind === "24h" ? "tomorrow" : "in 2 hours";
  const manage = input.manageUrl ? ` Manage: ${input.manageUrl}` : "";
  return [
    {
      to: input.studentEmail,
      subject: `Reminder: lesson ${label} with ${input.coachName}`,
      text: `Hi ${input.studentName}, your private lesson with ${input.coachName} is ${label}: ${input.when} at ${input.location}.${manage}`,
    },
    {
      to: input.coachEmail,
      subject: `Reminder: ${input.studentName} ${label}`,
      text: `${input.studentName} has a private lesson ${label}: ${input.when} at ${input.location}.`,
    },
  ];
}


export function manageLinkMail(input: { email: string; link: string; code: string }): Mail {
  return {
    to: input.email,
    subject: "Your BookMe bookings link",
    text: `Open this one-time link to manage your private lessons: ${input.link}\n\nOr enter this code: ${input.code}\nIt expires in 30 minutes. Request a new one if it was already used.`,
  };
}
