"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { today as todayInGym } from "@/lib/clock";

export type BodyLogState = { error: string | null; saved: boolean };

export async function logBodyWeight(
  _prev: BodyLogState,
  formData: FormData,
): Promise<BodyLogState> {
  const weight = Number(formData.get("weight_kg"));
  const notes = String(formData.get("notes") ?? "").trim() || null;

  // The waist is optional and measured far less often than the weight, so an
  // empty field leaves whatever was there alone rather than blanking it.
  const rawWaist = String(formData.get("waist_cm") ?? "").trim();
  const waist = rawWaist === "" ? null : Number(rawWaist.replace(",", "."));

  if (!Number.isFinite(weight) || weight < 25 || weight > 300) {
    return { error: "Indica um peso entre 25 e 300 kg.", saved: false };
  }
  if (waist !== null && (!Number.isFinite(waist) || waist < 40 || waist > 200)) {
    return { error: "Indica uma cintura entre 40 e 200 cm.", saved: false };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "A sessão expirou. Entra outra vez.", saved: false };

  const { error } = await supabase.from("body_logs").upsert(
    {
      user_id: user.id,
      measured_on: todayInGym(),
      weight_kg: weight,
      ...(waist === null ? {} : { waist_cm: waist }),
      notes,
    },
    { onConflict: "user_id,measured_on" },
  );

  if (error) return { error: "Não deu para guardar. Tenta outra vez.", saved: false };

  revalidatePath("/progress");
  return { error: null, saved: true };
}

export type GoalState = { error: string | null; saved: boolean };

/** Sets, or clears, the body-weight goal the chart draws a line for. */
export async function setWeightGoal(
  _prev: GoalState,
  formData: FormData,
): Promise<GoalState> {
  const raw = String(formData.get("weight_goal_kg") ?? "").trim();
  const goal = raw === "" ? null : Number(raw);

  if (goal !== null && (!Number.isFinite(goal) || goal < 25 || goal > 300)) {
    return { error: "Indica um objetivo entre 25 e 300 kg.", saved: false };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "A sessão expirou. Entra outra vez.", saved: false };

  const { error } = await supabase
    .from("profiles")
    .update({ weight_goal_kg: goal })
    .eq("id", user.id);

  if (error) return { error: "Não deu para guardar o objetivo.", saved: false };

  revalidatePath("/progress");
  return { error: null, saved: true };
}
