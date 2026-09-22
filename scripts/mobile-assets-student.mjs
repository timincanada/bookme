#!/usr/bin/env node
/**
 * Generate iOS/Android icons + splash for the student shell from the brand
 * app icon, without permanently overwriting coach `assets/icon-only.png`.
 */
import { copyFileSync, existsSync, renameSync, unlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const brand = resolve(root, "public/brand/bookme-app-icon.png");
const iconOnly = resolve(root, "assets/icon-only.png");
const backup = resolve(root, "assets/icon-only.png.coach-backup");

if (!existsSync(brand)) {
  console.error("Missing public/brand/bookme-app-icon.png");
  process.exit(1);
}
if (existsSync(backup)) {
  console.error(`Stale backup at ${backup}; restore or remove before retrying.`);
  process.exit(1);
}

let code = 1;
try {
  renameSync(iconOnly, backup);
  copyFileSync(brand, iconOnly);
  const bin = resolve(root, "node_modules/.bin/capacitor-assets");
  const args = [
    "generate",
    "--ios",
    "--android",
    "--iosProject",
    "ios-student/App",
    "--androidProject",
    "android-student",
    "--iconBackgroundColor",
    "#1f4d3a",
    "--iconBackgroundColorDark",
    "#1f4d3a",
    "--splashBackgroundColor",
    "#f6f1e7",
    "--splashBackgroundColorDark",
    "#f6f1e7",
  ];
  const result = spawnSync(bin, args, { cwd: root, stdio: "inherit" });
  code = result.status ?? 1;
} finally {
  if (existsSync(iconOnly) && existsSync(backup)) unlinkSync(iconOnly);
  if (existsSync(backup)) renameSync(backup, iconOnly);
}
process.exit(code);
