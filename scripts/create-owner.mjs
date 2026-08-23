/**
 * Creates the first account. Run once, locally, after applying the migration.
 *
 *   node scripts/create-owner.mjs "Full Name" you@example.com "a-strong-password"
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  try {
    const raw = readFileSync(resolve(ROOT, ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const match = /^([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line.trim());
      if (!match) continue;
      const value = match[2].replace(/^["']|["']$/g, "");
      if (!process.env[match[1]]) process.env[match[1]] = value;
    }
  } catch {
    // Environment may already be provided by the shell.
  }
}

loadEnv();

const [name, email, password] = process.argv.slice(2);

if (!name || !email || !password) {
  console.error(
    'Usage: node scripts/create-owner.mjs "Full Name" email@example.com "password"',
  );
  process.exit(1);
}

if (password.length < 8) {
  console.error("Choose a password of at least 8 characters.");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { count } = await admin
  .from("profiles")
  .select("id", { count: "exact", head: true });

if ((count ?? 0) > 0) {
  console.error("An account already exists. Invite the second member in-app.");
  process.exit(1);
}

const { data, error } = await admin.auth.admin.createUser({
  email: email.toLowerCase(),
  password,
  email_confirm: true,
});

if (error || !data.user) {
  console.error("Could not create the account:", error?.message);
  process.exit(1);
}

const { error: profileError } = await admin.from("profiles").insert({
  id: data.user.id,
  name,
  email: email.toLowerCase(),
  is_owner: true,
});

if (profileError) {
  await admin.auth.admin.deleteUser(data.user.id);
  console.error("Could not create the profile:", profileError.message);
  process.exit(1);
}

console.log(`Owner account created for ${email}. Sign in at /login.`);
