import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { ensureDemoCoach } from "@/lib/bookme/api";
import { DEMO_STUDENTS } from "@/lib/bookme/demo";
import { StudentContext } from "@/lib/bookme/student-context";
import { getStudentMe, requestStudentCode, studentSignOut, verifyStudentCode, verifyStudentLink } from "@/lib/bookme/student-api";
import { cn } from "@/lib/utils";
import { forgetDevice } from "@/lib/native/device";

type Search = { email?: string; token?: string };

export const Route = createFileRoute("/manage")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    email: typeof s.email === "string" ? s.email : undefined,
    token: typeof s.token === "string" ? s.token : undefined,
  }),
  component: Portal,
});

const LEGACY_SESSION_KEY = "bookme.student.session";

function Portal() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [me, setMe] = useState<string | null | undefined>(undefined);
  const [email, setEmail] = useState(search.email || "");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"request" | "code">("request");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [previewCode, setPreviewCode] = useState("");

  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_SESSION_KEY);
    } catch {
      // storage unavailable — nothing to clean up
    }
    const token = search.token;
    if (token) {
      void navigate({ to: pathname, search: { email: undefined, token: undefined }, replace: true });
      verifyStudentLink({ data: { token } }).then((res) => {
        if (res.ok) setMe(res.email);
        else {
          setMe(null);
          setStep("code");
          setMsg(res.error);
        }
      });
      return;
    }
    getStudentMe().then((r) => setMe(r.signedIn ? r.email : null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendCode() {
    setBusy(true);
    setMsg("");
    if (DEMO_STUDENTS.some((s) => s.email === email.trim().toLowerCase())) await ensureDemoCoach();
    const res = await requestStudentCode({ data: { email } });
    setBusy(false);
    setMsg(res.message);
    if (!res.sent) {
      setPreviewCode("");
      return;
    }
    setStep("code");
    setPreviewCode("previewCode" in res && res.previewCode ? res.previewCode : "");
  }

  async function verify() {
    setBusy(true);
    const res = await verifyStudentCode({ data: { email, code } });
    setBusy(false);
    if (!res.ok) return setMsg(res.error);
    setCode("");
    setMsg("");
    setMe(res.email);
  }

  async function signOut() {
    await forgetDevice();
    await studentSignOut();
    setMe(null);
    setStep("request");
  }

  return (
    <main className="min-h-screen bg-paper">
      <header className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-5 py-5 sm:px-8">
        <Logo />
        {me ? (
          <button type="button" className="text-sm font-semibold text-forest" onClick={() => void signOut()}>
            Sign out
          </button>
        ) : null}
      </header>
      <div className="mx-auto max-w-xl px-5 pb-16 sm:px-8">
        {me === undefined ? <p className="text-muted">Loading…</p> : null}
        {me === null ? (
          <>
            <h1 className="font-display text-4xl font-medium">Your bookings</h1>
            {step === "request" ? (
              <>
                <p className="mt-2 text-ink-soft">Use the email from your booking. We send a one-time code — no password.</p>
                <input
                  className="field mt-4"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                />
                <Button className="mt-3" size="field" disabled={busy || !email} onClick={() => void sendCode()}>
                  Email me a code
                </Button>
                <button type="button" className="mt-4 text-left text-sm text-forest" onClick={() => setEmail(DEMO_STUDENTS[0].email)}>
                  Use demo student
                  <span className="mt-0.5 block text-muted">{DEMO_STUDENTS[0].email}</span>
                </button>
              </>
            ) : (
              <>
                <p className="mt-2 text-ink-soft">Open the link in the email, or enter the 6-digit code.</p>
                {previewCode ? (
                  <p className="mt-3 rounded-xl bg-sage-3 px-4 py-3 text-sm text-forest">
                    Development code: <span className="font-semibold tracking-widest">{previewCode}</span>
                  </p>
                ) : null}
                <input
                  className="field mt-4"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                />
                <Button className="mt-3" size="field" disabled={busy || code.length !== 6} onClick={() => void verify()}>
                  Verify code
                </Button>
                <button type="button" className="mt-3 text-sm font-semibold text-forest" disabled={busy} onClick={() => void sendCode()}>
                  Send a new code
                </button>
              </>
            )}
            {msg ? <p className="mt-4 text-sm text-ink-soft">{msg}</p> : null}
          </>
        ) : null}
        {me ? (
          <StudentContext.Provider value={{ email: me, signedOut: () => setMe(null) }}>
            <p className="text-sm text-muted">{me}</p>
            <nav className="mt-3 flex gap-2" aria-label="Portal">
              <PortalTab to="/manage" on={pathname === "/manage" || pathname === "/manage/"}>
                Lessons
              </PortalTab>
              <PortalTab to="/manage/messages" on={pathname.startsWith("/manage/messages")}>
                Messages
              </PortalTab>
              <PortalTab to="/manage/account" on={pathname.startsWith("/manage/account")}>
                Account
              </PortalTab>
            </nav>
            <Outlet />
          </StudentContext.Provider>
        ) : null}
      </div>
    </main>
  );
}

function PortalTab({ to, on, children }: { to: "/manage" | "/manage/messages" | "/manage/account"; on: boolean; children: string }) {
  return (
    <Link
      to={to}
      search={to === "/manage" ? { email: undefined, token: undefined } : undefined}
      className={cn("rounded-full px-4 py-2 text-sm", on ? "bg-forest text-on-forest" : "ring-1 ring-line")}
    >
      {children}
    </Link>
  );
}
