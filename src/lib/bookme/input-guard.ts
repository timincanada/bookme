/**
 * Runtime guard for server-function input. TypeScript types vanish at runtime,
 * so every server function passes its input through this: plain JSON-like data
 * only, bounded size, no prototype keys. Endpoint-specific checks still live in
 * the handlers.
 */
const MAX_DEPTH = 6;
const MAX_STRING = 20_000;
const MAX_ARRAY = 500;
const MAX_KEYS = 100;
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export class InvalidInputError extends Error {
  constructor(reason: string) {
    super(`Invalid input: ${reason}`);
    this.name = "InvalidInputError";
  }
}

function check(value: unknown, depth: number, path: string): void {
  if (depth > MAX_DEPTH) throw new InvalidInputError(`${path || "input"} is nested too deeply`);
  if (value === null || value === undefined || typeof value === "boolean") return;
  if (typeof value === "string") {
    if (value.length > MAX_STRING) throw new InvalidInputError(`${path || "input"} is too long`);
    return;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new InvalidInputError(`${path || "input"} must be a finite number`);
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > MAX_ARRAY) throw new InvalidInputError(`${path || "input"} has too many items`);
    value.forEach((v, i) => check(v, depth + 1, `${path}[${i}]`));
    return;
  }
  if (typeof value === "object") {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) throw new InvalidInputError(`${path || "input"} must be a plain object`);
    const keys = Object.keys(value as object);
    if (keys.length > MAX_KEYS) throw new InvalidInputError(`${path || "input"} has too many fields`);
    for (const k of keys) {
      if (FORBIDDEN_KEYS.has(k)) throw new InvalidInputError(`field "${k}" is not allowed`);
      check((value as Record<string, unknown>)[k], depth + 1, path ? `${path}.${k}` : k);
    }
    return;
  }
  throw new InvalidInputError(`${path || "input"} has an unsupported type`);
}

export function guardInput<T>(input: T): T {
  if (input !== undefined && input !== null && (typeof input !== "object" || Array.isArray(input))) {
    throw new InvalidInputError("expected an object");
  }
  check(input, 0, "");
  return input;
}
