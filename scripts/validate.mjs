#!/usr/bin/env node
// Validates reels/reels.json. Exit code 1 on any error. Run: npm run validate
// The rules live in reels/schema.js, shared with the browser.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { validateData } from "../reels/schema.js";

const file = process.argv[2] ?? fileURLToPath(new URL("../reels/reels.json", import.meta.url));

let data;
try {
  data = JSON.parse(await readFile(file, "utf8"));
} catch (err) {
  console.error(`✗ ${file}: ${err.message}`);
  process.exit(1);
}

const { errors, warnings } = validateData(data);
for (const w of warnings) console.warn(`! ${w}`);
for (const e of errors) console.error(`✗ ${e}`);

if (errors.length) {
  console.error(`\n${errors.length} error(s) in ${file}`);
  process.exit(1);
}
console.log(`✓ ${file}: ${data.reels.length} reel(s) valid${warnings.length ? `, ${warnings.length} warning(s)` : ""}`);
