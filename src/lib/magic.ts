import { randomBytes, randomInt } from "crypto";

export const MAGIC_MS = 30 * 60 * 1000;

export function makeToken() {
  return randomBytes(24).toString("hex");
}

export function makeCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function magicExpiresAt(now = new Date()) {
  return new Date(now.getTime() + MAGIC_MS);
}

export function isMagicOpen(
  link: { expiresAt: Date; usedAt?: Date | null },
  now = new Date(),
) {
  if (link.usedAt) return false;
  return link.expiresAt.getTime() > now.getTime();
}

export { normalizeEmail } from "./email";
