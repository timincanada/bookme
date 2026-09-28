/**
 * Node-only Open-Meteo fixture paths. Imported dynamically from weather-service
 * so client bundles never evaluate `node:path` / `node:fs`.
 */
import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";

export function readFixture(path: string) {
  return readFile(path, "utf8");
}

/** `extreme` is the shipped storm. Anything else is a file path, absolute or from cwd. */
export function resolveOpenMeteoFixture(spec: string, cwd = process.cwd()) {
  const trimmed = spec.trim();
  if (trimmed === "extreme") return { kind: "extreme" as const };
  const path = isAbsolute(trimmed) ? trimmed : resolve(cwd, trimmed);
  return { kind: "file" as const, path };
}
