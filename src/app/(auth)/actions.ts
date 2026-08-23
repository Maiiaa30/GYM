"use server";

import { createHash, timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type FormState = { error: string | null };

const GENERIC_CREDENTIALS_ERROR = "Email or password is not correct.";

export async function signIn(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: GENERIC_CREDENTIALS_ERROR };
  }

  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

function hashCode(code: string) {
  return createHash("sha256")
    .update(code.trim().toUpperCase().replace(/[^A-Z0-9]/g, ""))
    .digest("hex");
}

function constantTimeEquals(a: string, b: string) {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

/**
 * Redeems an invitation: the invited member supplies the code they were given
 * plus a password of their choosing. The account already exists but has no
 * usable password until this point.
 */
export async function redeemInvite(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const code = String(formData.get("code") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!email || !code || !password) {
    return { error: "Fill in every field." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (password !== confirm) {
    return { error: "The two passwords do not match." };
  }

  const admin = createAdminClient();

  const { data: invites, error: lookupError } = await admin
    .from("invites")
    .select("*")
    .eq("email", email)
    .is("redeemed_at", null)
    .gt("expires_at", new Date().toISOString())
    .limit(1);

  if (lookupError) {
    return { error: "Could not verify the invitation. Try again." };
  }

  const invite = invites?.[0];
  if (!invite || !constantTimeEquals(invite.code_hash, hashCode(code))) {
    return { error: "That invitation code is not valid." };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (!profile) {
    return { error: "No account is waiting for that email." };
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(
    profile.id,
    { password, email_confirm: true },
  );

  if (updateError) {
    return { error: "Could not set the password. Try again." };
  }

  await admin
    .from("invites")
    .update({ redeemed_at: new Date().toISOString(), redeemed_by: profile.id })
    .eq("id", invite.id);

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    return { error: "Password set. Sign in to continue." };
  }

  redirect("/onboarding");
}
