export type Mail = { to: string; subject: string; text: string };

export function confirmationMails(input: {
  coachName: string;
  coachEmail: string;
  studentName: string;
  studentEmail: string;
  when: string;
  location: string;
  method: "cash" | "card" | string;
}): Mail[] {
  const pay = input.method === "cash" ? "Pay cash on arrival." : "Card payment received.";
  return [
    {
      to: input.studentEmail,
      subject: `Booked with ${input.coachName}`,
      text: `Hi ${input.studentName}, your private lesson with ${input.coachName} is confirmed for ${input.when} at ${input.location}. ${pay}`,
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
  console.log("[mail stub]", mail.to, mail.subject);
}

export async function sendLessonConfirmations(input: Parameters<typeof confirmationMails>[0]) {
  for (const mail of confirmationMails(input)) {
    await sendMail(mail);
  }
}
