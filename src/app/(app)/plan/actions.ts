"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  templateDays,
  templateName,
  templateRationale,
} from "@/lib/templates";

export type PlanState = { error: string | null };

/**
 * Replaces the active block with the built-in template for the current
 * settings. Writes go through the service role because programme rows are
 * shared by both members and are therefore read-only under row level security.
 */
export async function buildTemplatePlan(
  _prev: PlanState,
  _formData: FormData,
): Promise<PlanState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Session expired. Sign in again." };

  const { data: settings } = await supabase
    .from("household_settings")
    .select("days_per_week, equipment")
    .maybeSingle();

  if (!settings) return { error: "Settings are missing." };

  const days = templateDays(settings.equipment, settings.days_per_week);
  const admin = createAdminClient();

  const { error: deactivateError } = await admin
    .from("plans")
    .update({ is_active: false })
    .eq("is_active", true);

  if (deactivateError) return { error: "Could not replace the current block." };

  const { data: plan, error: planError } = await admin
    .from("plans")
    .insert({
      name: templateName(settings.equipment),
      block_start: new Date().toISOString().slice(0, 10),
      weeks: 4,
      equipment: settings.equipment,
      source: "template",
      rationale: templateRationale(settings.equipment, settings.days_per_week),
      is_active: true,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (planError || !plan) return { error: "Could not create the block." };

  for (const [index, day] of days.entries()) {
    const { data: planDay, error: dayError } = await admin
      .from("plan_days")
      .insert({
        plan_id: plan.id,
        day_index: index,
        name: day.name,
        focus: day.focus,
      })
      .select("id")
      .single();

    if (dayError || !planDay) return { error: "Could not create a training day." };

    const { error: itemError } = await admin.from("plan_items").insert(
      day.items.map((item, position) => ({
        plan_day_id: planDay.id,
        position,
        exercise: item.exercise,
        sets: item.sets,
        rep_low: item.repLow,
        rep_high: item.repHigh,
        rest_sec: item.restSec,
        notes: item.notes ?? null,
      })),
    );

    if (itemError) return { error: "Could not add the exercises." };
  }

  revalidatePath("/plan");
  revalidatePath("/");
  return { error: null };
}
