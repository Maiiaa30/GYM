"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type BodyLogState = { error: string | null; saved: boolean };

export async function logBodyWeight(
  _prev: BodyLogState,
  formData: FormData,
): Promise<BodyLogState> {
  const weight = Number(formData.get("weight_kg"));
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!Number.isFinite(weight) || weight < 25 || weight > 300) {
    return { error: "Indica um peso entre 25 e 300 kg.", saved: false };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "A sessão expirou. Entra outra vez.", saved: false };

  const { error } = await supabase.from("body_logs").upsert(
    {
      user_id: user.id,
      measured_on: new Date().toISOString().slice(0, 10),
      weight_kg: weight,
      notes,
    },
    { onConflict: "user_id,measured_on" },
  );

  if (error) return { error: "Não foi possível guardar. Tenta outra vez.", saved: false };

  revalidatePath("/progress");
  return { error: null, saved: true };
}
