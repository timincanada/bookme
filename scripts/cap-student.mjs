#!/usr/bin/env node
/**
 * Run Capacitor CLI against the student app config without touching the coach
 * default (capacitor.config.ts → ios/ + android/).
 *
 * Capacitor only loads capacitor.config.ts|js|json, so we swap in
 * capacitor.config.student.ts for the duration of the command, then restore.
 *
 * Usage:
 *   node scripts/cap-student.mjs sync
 *   node scripts/cap-student.mjs sync ios
 *   node scripts/cap-student.mjs add ios
 *   node scripts/cap-student.mjs open ios
 *   node scripts/cap-student.mjs open android
 */
import { copyFileSync, existsSync, renameSync, unlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const active = resolve(root, "capacitor.config.ts");
const student = resolve(root, "capacitor.config.student.ts");
const backup = resolve(root, "capacitor.config.ts.coach-backup");

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node scripts/cap-student.mjs <cap-args…>");
  console.error("Example: node scripts/cap-student.mjs sync ios");
  process.exit(1);
}

if (!existsSync(student)) {
  console.error("Missing capacitor.config.student.ts");
  process.exit(1);
}

if (existsSync(backup)) {
  console.error(`Stale backup at ${backup}; restore or remove it before retrying.`);
  process.exit(1);
}

let exitCode = 1;
try {
  renameSync(active, backup);
  copyFileSync(student, active);
  const cap = resolve(root, "node_modules/.bin/cap");
  const result = spawnSync(cap, args, { cwd: root, stdio: "inherit", env: process.env });
  exitCode = result.status ?? 1;
  if (result.error) {
    console.error(result.error);
    exitCode = 1;
  }
} finally {
  if (existsSync(active) && existsSync(backup)) {
    unlinkSync(active);
  }
  if (existsSync(backup)) {
    renameSync(backup, active);
  }
}

process.exit(exitCode);
