/**
 * Uploads src/data/catalogue.json into the exercises table.
 * Safe to run repeatedly: rows are matched on the slug.
 *
 *   node scripts/seed-catalogue.mjs
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

for (const line of readFileSync(resolve(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const match = /^([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line.trim());
  if (match && !process.env[match[1]]) {
    process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing Supabase configuration in .env.local");
  process.exit(1);
}

const catalogue = JSON.parse(
  readFileSync(resolve(ROOT, "src/data/catalogue.json"), "utf8"),
);

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { error } = await supabase
  .from("exercises")
  .upsert(catalogue, { onConflict: "slug" });

if (error) {
  console.error("Seeding failed:", error.message);
  process.exit(1);
}

console.log(`Seeded ${catalogue.length} exercises.`);
