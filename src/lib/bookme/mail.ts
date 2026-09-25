export type Mail = { to: string; subject: string; text: string; html?: string };
export type SendMailResult = { ok: true; id?: string } | { ok: false; error: string };

const DEFAULT_FROM = "BookMe <noreply@bookme.training>";

export function resendApiKey(env: NodeJS.ProcessEnv = process.env) {
  return env.RESEND_API_KEY?.trim() || "";
}

/** Production has no local stub. A missing key must not look like a delivered email. */
export function productionMailConfigError(env: NodeJS.ProcessEnv = process.env): string | null {
  if (env.NODE_ENV !== "production") return null;
  if (!resendApiKey(env)) return "RESEND_API_KEY is not set";
  return null;
}

function htmlFromText(text: string) {
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const body = escaped
    .split(/\n{2,}/)
    .map((part) => `<p>${part.replace(/\n/g, "<br>\n")}</p>`)
    .join("\n");
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;font-size:16px;color:#1a1a1a">${body}</body></html>`;
}

export type MailMeta = {
  bookingId?: string;
  template?: string;
};

const MAIL_TIMEOUT_MS = 15_000;

function logMail(fields: Record<string, unknown>) {
  console.log(JSON.stringify(fields));
}

export function confirmationMails(input: {
  coachName: string;
  coachEmail: string;
  studentName: string;
  studentEmail: string;
  when: string;
  location: string;
  method?: "cash" | "card" | string;
  manageUrl?: string;
  /** Coach booking page. Manage/cancel links stay on manageUrl. */
  bookAgainUrl?: string;
}): Mail[] {
  const manage = input.manageUrl ? ` Manage: ${input.manageUrl}` : "";
  const again = input.bookAgainUrl?.trim() ? `\n\nBook another lesson: ${input.bookAgainUrl.trim()}` : "";
  return [
    {
      to: input.studentEmail,
      subject: `Booked with ${input.coachName}`,
      text: `Hi ${input.studentName}, your private lesson with ${input.coachName} is confirmed for ${input.when} at ${input.location}.${manage}${again}`,
    },
    {
      to: input.coachEmail,
      subject: `New lesson: ${input.studentName}`,
      text: `${input.studentName} booked a private lesson on ${input.when} at ${input.location}.`,
    },
  ];
}

export async function sendMail(mail: Mail, meta: MailMeta = {}): Promise<SendMailResult> {
  const base = {
    bookingId: meta.bookingId,
    template: meta.template,
    to: mail.to,
  };

  if (!String(mail.to || "").trim()) {
    // Clients imported without an email: nothing to send, not an error.
    logMail({ msg: "mail_skipped_no_recipient", ...base, subject: mail.subject });
    return { ok: true };
  }

  const configError = productionMailConfigError();
  if (!resendApiKey()) {
    if (configError) {
      logMail({ msg: "mail_not_configured", ...base, error: configError });
      return { ok: false, error: configError };
    }
    logMail({ msg: "mail_stub", ...base, subject: mail.subject });
    console.log("[mail stub]", mail.to, mail.subject, mail.text);
    return { ok: true };
  }

  const from = process.env.MAIL_FROM?.trim() || DEFAULT_FROM;
  const fromDefault = !process.env.MAIL_FROM?.trim();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MAIL_TIMEOUT_MS);
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [mail.to],
        subject: mail.subject,
        text: mail.text,
        html: mail.html || htmlFromText(mail.text),
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      const error = `Resend ${response.status}: ${body.slice(0, 500)}`;
      logMail({ msg: "mail_send_failed", ...base, error, fromDefault });
      return { ok: false, error };
    }
    const payload = (await response.json().catch(() => null)) as { id?: unknown } | null;
    const id = payload && typeof payload.id === "string" ? payload.id : "";
    if (!id) {
      const error = "Resend response missing message id";
      logMail({ msg: "mail_send_failed", ...base, error, fromDefault });
      return { ok: false, error };
    }
    logMail({ msg: "mail_sent", ...base, id, fromDefault });
    return { ok: true, id };
  } catch (err) {
    const error =
      err instanceof Error
        ? err.name === "AbortError"
          ? `timeout after ${MAIL_TIMEOUT_MS}ms`
          : err.message
        : String(err);
    logMail({ msg: "mail_send_failed", ...base, error });
    return { ok: false, error };
  } finally {
    clearTimeout(timer);
  }
}

export async function sendLessonConfirmations(
  input: Parameters<typeof confirmationMails>[0] & { bookingId?: string },
): Promise<SendMailResult> {
  let lastError: string | undefined;
  for (const mail of confirmationMails(input)) {
    const result = await sendMail(mail, { bookingId: input.bookingId, template: "confirm" });
    if (!result.ok) lastError = result.error;
  }
  return lastError ? { ok: false, error: lastError } : { ok: true };
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
  manageUrl?: string;
}): Mail[] {
  const manage = input.manageUrl ? ` Manage: ${input.manageUrl}` : "";
  if (input.kind === "rescheduled") {
    return [
      {
        to: input.studentEmail,
        subject: `Lesson moved with ${input.coachName}`,
        text: `Hi ${input.studentName}, your lesson with ${input.coachName} moved from ${input.when} to ${input.nextWhen}.${manage}`,
      },
      {
        to: input.coachEmail,
        subject: `Lesson moved: ${input.studentName}`,
        text: `${input.studentName}'s lesson moved from ${input.when} to ${input.nextWhen}.`,
      },
    ];
  }
  if (input.kind === "cancelled") {
    return [
      {
        to: input.studentEmail,
        subject: `Lesson cancelled with ${input.coachName}`,
        text: `Hi ${input.studentName}, your lesson with ${input.coachName} on ${input.when} was cancelled.${manage}`,
      },
      {
        to: input.coachEmail,
        subject: `Lesson cancelled: ${input.studentName}`,
        text: `${input.studentName}'s lesson on ${input.when} was cancelled.`,
      },
    ];
  }
  if (input.kind === "next_week_cash") {
    return [
      {
        to: input.studentEmail,
        subject: `Booked next week with ${input.coachName}`,
        text: `Hi ${input.studentName}, ${input.coachName} booked you for ${input.nextWhen}.`,
      },
      {
        to: input.coachEmail,
        subject: `Next week booked: ${input.studentName}`,
        text: `${input.studentName} is booked for ${input.nextWhen}.`,
      },
    ];
  }
  return [
    {
      to: input.studentEmail,
      subject: `Next week with ${input.coachName}`,
      text: `Hi ${input.studentName}, ${input.coachName} booked you for ${input.nextWhen}.`,
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
    subject: "Your BookMe sign-in code",
    text: `Your BookMe sign-in code is ${input.code}.\n\nIt expires in 30 minutes. You can also open this one-time link:\n${input.link}\n\nIf you didn't request this, you can ignore this email.`,
  };
}

export function studentMessageMail(input: {
  studentEmail: string;
  studentName: string;
  coachName: string;
  body: string;
}): Mail {
  return {
    to: input.studentEmail,
    subject: "Message from " + input.coachName,
    text: "Hi " + input.studentName + ",\n\n" + input.body + "\n\n— " + input.coachName + " via BookMe",
  };
}

export function recurringAddedMail(input: {
  studentEmail: string;
  studentName: string;
  coachName: string;
  slots: string[];
  repeat: string;
  startLabel: string;
  endLabel: string;
  count: number;
  location: string;
  timezone: string;
  manageUrl: string;
}): Mail {
  return {
    to: input.studentEmail,
    subject: `Your regular lessons with ${input.coachName}`,
    text: [
      `Hi ${input.studentName},`,
      "",
      `${input.coachName} added your regular lessons to BookMe:`,
      `${input.repeat}: ${input.slots.join(", ")} (${input.timezone})`,
      `${input.startLabel} to ${input.endLabel} · ${input.count} lesson${input.count === 1 ? "" : "s"} at ${input.location}`,
      "",
      `See your lessons: ${input.manageUrl}`,
    ].join("\n"),
  };
}

export function recurringEndedMail(input: {
  studentEmail: string;
  studentName: string;
  coachName: string;
  fromLabel: string;
  cancelled: number;
  manageUrl: string;
}): Mail {
  return {
    to: input.studentEmail,
    subject: `Regular lessons with ${input.coachName} are ending`,
    text: [
      `Hi ${input.studentName},`,
      "",
      `${input.coachName} ended your regular lessons from ${input.fromLabel}.`,
      input.cancelled
        ? `${input.cancelled} upcoming lesson${input.cancelled === 1 ? " was" : "s were"} cancelled.`
        : "No upcoming lessons were affected.",
      "",
      `See your lessons: ${input.manageUrl}`,
    ].join("\n"),
  };
}

/** New-message notice. Never includes the message text. */
export function newMessageMail(input: { to: string; name: string; fromName: string; link: string }): Mail {
  return {
    to: input.to,
    subject: `New message from ${input.fromName}`,
    text: `Hi ${input.name},\n\nYou have a new message from ${input.fromName} on BookMe.\n\nRead and reply: ${input.link}`,
  };
}

export function mailIsStub() {
  return !resendApiKey();
}

export function studentMoveRequestMails(input: {
  coachName: string;
  coachEmail: string;
  studentName: string;
  studentEmail: string;
  when: string;
  nextWhen: string;
  note: string;
  inboxUrl: string;
  manageUrl: string;
}): Mail[] {
  const note = input.note ? ` Note: ${input.note}` : "";
  return [
    {
      to: input.coachEmail,
      subject: `${input.studentName} asked to move a lesson`,
      text: `${input.studentName} asked to move ${input.when} to ${input.nextWhen}.${note} Review: ${input.inboxUrl}`,
    },
    {
      to: input.studentEmail,
      subject: `Request sent to ${input.coachName}`,
      text: `Hi ${input.studentName}, we sent ${input.coachName} your request to move ${input.when} to ${input.nextWhen}. You'll hear back by email.${input.manageUrl ? ` Manage: ${input.manageUrl}` : ""}`,
    },
  ];
}

export function coachSwapRequestMail(input: {
  studentEmail: string;
  studentName: string;
  coachName: string;
  yourWhen: string;
  otherWhen: string;
  note: string;
  decideUrl: string;
}): Mail {
  const note = input.note ? `\n\n${input.coachName} wrote: ${input.note}` : "";
  return {
    to: input.studentEmail,
    subject: `${input.coachName} proposes a time swap`,
    text: `Hi ${input.studentName}, ${input.coachName} would like to swap your lesson at ${input.yourWhen} with another student's lesson at ${input.otherWhen}.${note}\n\nAccept or decline: ${input.decideUrl}`,
  };
}

export function requestResolvedMail(input: {
  studentEmail: string;
  studentName: string;
  coachName: string;
  kind: "accepted" | "declined" | "withdrawn";
  summary: string;
  manageUrl?: string;
}): Mail {
  const manage = input.manageUrl ? ` Manage: ${input.manageUrl}` : "";
  if (input.kind === "accepted") {
    return {
      to: input.studentEmail,
      subject: `Lesson change confirmed with ${input.coachName}`,
      text: `Hi ${input.studentName}, ${input.summary}${manage}`,
    };
  }
  if (input.kind === "withdrawn") {
    return {
      to: input.studentEmail,
      subject: `Time swap withdrawn by ${input.coachName}`,
      text: `Hi ${input.studentName}, ${input.summary}${manage}`,
    };
  }
  return {
    to: input.studentEmail,
    subject: `Lesson change did not go through`,
    text: `Hi ${input.studentName}, ${input.summary}${manage}`,
  };
}
