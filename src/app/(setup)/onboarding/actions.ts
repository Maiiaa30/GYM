"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { today as todayInGym } from "@/lib/clock";

export type OnboardingState = { error: string | null };

export async function completeOnboarding(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const name = String(formData.get("name") ?? "").trim();
  const height = Number(formData.get("height_cm"));
  const weight = Number(formData.get("weight_kg"));
  const birthDate = String(formData.get("birth_date") ?? "").trim();
  const sex = String(formData.get("sex") ?? "undisclosed");
  const injuryNotes = String(formData.get("injury_notes") ?? "").trim() || null;

  if (!name) return { error: "Escreve o teu nome." };
  if (!Number.isFinite(height) || height < 120 || height > 230) {
    return { error: "Indica uma altura entre 120 e 230 cm." };
  }
  if (!Number.isFinite(weight) || weight < 25 || weight > 300) {
    return { error: "Indica um peso entre 25 e 300 kg." };
  }
  if (!["male", "female", "other", "undisclosed"].includes(sex)) {
    return { error: "Escolhe uma opção válida." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "A sessão expirou. Entra outra vez." };

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      name,
      height_cm: height,
      birth_date: birthDate || null,
      sex: sex as "male" | "female" | "other" | "undisclosed",
      injury_notes: injuryNotes,
      onboarded_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (profileError) return { error: "Não deu para guardar os teus dados." };

  const { error: bodyError } = await supabase.from("body_logs").upsert(
    {
      user_id: user.id,
      measured_on: todayInGym(),
      weight_kg: weight,
    },
    { onConflict: "user_id,measured_on" },
  );

  if (bodyError) return { error: "Não deu para guardar o teu peso." };

  redirect("/");
}
