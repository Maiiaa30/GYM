"use server";

import { createHash, timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type FormState = { error: string | null };

const GENERIC_CREDENTIALS_ERROR = "Email ou palavra-passe incorretos.";

export async function signIn(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Escreve o email e a palavra-passe." };
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
    return { error: "Preenche todos os campos." };
  }
  if (password.length < 8) {
    return { error: "A palavra-passe tem de ter pelo menos 8 caracteres." };
  }
  if (password !== confirm) {
    return { error: "As duas palavras-passe não coincidem." };
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
    return { error: "Não deu para verificar o convite. Tenta outra vez." };
  }

  const invite = invites?.[0];
  if (!invite || !constantTimeEquals(invite.code_hash, hashCode(code))) {
    return { error: "Esse código de convite não é válido." };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (!profile) {
    return { error: "Não existe nenhuma conta à espera desse email." };
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(
    profile.id,
    { password, email_confirm: true },
  );

  if (updateError) {
    return { error: "Não deu para definir a palavra-passe. Tenta outra vez." };
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
    return { error: "Palavra-passe definida. Entra para continuar." };
  }

  redirect("/onboarding");
}
