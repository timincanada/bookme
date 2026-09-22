import { readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const tsx = require.resolve("tsx/cli");
const dir = new URL("../src/lib/bookme/", import.meta.url);
const files = (await readdir(dir)).filter((f) => f.endsWith(".test.ts")).sort();

for (const file of files) {
  const path = join(dir.pathname, file);
  const code = await new Promise((resolve) => {
    const child = spawn(process.execPath, [tsx, path], { stdio: "inherit" });
    child.on("close", resolve);
  });
  if (code !== 0) process.exit(code ?? 1);
}
