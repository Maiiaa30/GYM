"use server";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EquipmentProfile } from "@/lib/database.types";

const EQUIPMENT: EquipmentProfile[] = ["full_gym", "hotel", "home_minimal"];

export type SettingsState = { error: string | null; saved: boolean };
export type InviteState = { error: string | null; code: string | null };

export async function updateSettings(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const days = Number(formData.get("days_per_week"));
  const minutes = Number(formData.get("session_minutes"));
  const equipment = String(formData.get("equipment") ?? "") as EquipmentProfile;

  if (!Number.isInteger(days) || days < 1 || days > 6) {
    return { error: "Os dias de treino têm de estar entre 1 e 6.", saved: false };
  }
  if (!Number.isInteger(minutes) || minutes < 20 || minutes > 150) {
    return { error: "A duração do treino tem de estar entre 20 e 150 minutos.", saved: false };
  }
  if (!EQUIPMENT.includes(equipment)) {
    return { error: "Escolhe um perfil de equipamento válido.", saved: false };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("household_settings")
    .update({
      days_per_week: days,
      session_minutes: minutes,
      equipment,
      updated_at: new Date().toISOString(),
    })
    .eq("id", "only");

  if (error) return { error: "Não deu para guardar as definições.", saved: false };

  revalidatePath("/settings");
  revalidatePath("/plan");
  return { error: null, saved: true };
}

/** Human-readable, unambiguous alphabet: no I, O, 0 or 1. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateCode() {
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i += 1) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
    if (i === 3) out += "-";
  }
  return out;
}

function hashCode(code: string) {
  return createHash("sha256")
    .update(code.replace(/[^A-Z0-9]/g, ""))
    .digest("hex");
}

/**
 * Creates the second account. The account exists immediately with an unusable
 * random password; the invited member sets their own on /join using the code
 * returned here, which is shown once and never stored in plain text.
 */
export async function createInvite(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!name || !email) return { error: "O nome e o email são obrigatórios.", code: null };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { error: "Esse email não é válido.", code: null };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "A sessão expirou.", code: null };

  const { data: me } = await supabase
    .from("profiles")
    .select("is_owner")
    .eq("id", user.id)
    .maybeSingle();

  if (!me?.is_owner) {
    return { error: "Só o dono da conta pode convidar.", code: null };
  }

  const admin = createAdminClient();

  const { count } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true });

  if ((count ?? 0) >= 2) {
    return { error: "As duas contas já existem.", code: null };
  }

  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    return { error: "Já existe uma conta com esse email.", code: null };
  }

  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email,
      password: randomUUID() + randomUUID(),
      email_confirm: true,
    });

  if (createError || !created.user) {
    return { error: "Não deu para criar a conta.", code: null };
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: created.user.id,
    name,
    email,
    is_owner: false,
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: "Não deu para criar o perfil.", code: null };
  }

  const code = generateCode();
  const { error: inviteError } = await admin.from("invites").insert({
    email,
    name,
    code_hash: hashCode(code),
    created_by: user.id,
  });

  if (inviteError) {
    return { error: "A conta foi criada, mas o código não funcionou. Tenta outra vez.", code: null };
  }

  revalidatePath("/settings");
  return { error: null, code };
}
