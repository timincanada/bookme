import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
export const SESSION_COOKIE = "bookme_coach";
export const STUDENT_COOKIE = "bookme_student";

function secret() {
  return process.env.AUTH_SECRET || "bookme-dev-secret";
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string | null | undefined) {
  if (!stored || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  const next = scryptSync(password, salt, 32);
  try {
    return timingSafeEqual(Buffer.from(hash, "hex"), next);
  } catch {
    return false;
  }
}

export function signSession(coachId: string) {
  const sig = createHmac("sha256", secret()).update(coachId).digest("hex");
  return `${coachId}.${sig}`;
}

export function readSession(token: string | undefined | null) {
  if (!token || !token.includes(".")) return null;
  const [id, sig] = token.split(".");
  const expect = createHmac("sha256", secret()).update(id).digest("hex");
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  } catch {
    return null;
  }
  return id;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  };
}


export function signStudent(email: string) {
  const payload = Buffer.from(email.toLowerCase()).toString("base64url");
  const sig = createHmac("sha256", secret()).update(`student:${payload}`).digest("hex");
  return `${payload}.${sig}`;
}

export function readStudent(token: string | undefined | null) {
  if (!token || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  const expect = createHmac("sha256", secret()).update(`student:${payload}`).digest("hex");
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  } catch {
    return null;
  }
  try {
    return Buffer.from(payload, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

export function studentCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 12,
  };
}
