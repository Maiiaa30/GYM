"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateJson } from "@/lib/gemini";
import {
  buildPrompt,
  planResponseSchema,
  validateGeneratedPlan,
  type CatalogueEntry,
  type GeneratedDay,
  type MemberContext,
} from "@/lib/plan-generation";
import {
  templateDays,
  templateName,
  templateRationale,
} from "@/lib/templates";
import { trainingDayNames } from "@/lib/schedule";
import type { EquipmentProfile, PlanSource } from "@/lib/database.types";

export type PlanState = {
  error: string | null;
  source: PlanSource | null;
  notice: string | null;
};

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

/* ------------------------------------------------------------ persistence */

async function persistPlan(
  admin: SupabaseAdmin,
  input: {
    name: string;
    rationale: string;
    equipment: EquipmentProfile;
    source: PlanSource;
    createdBy: string;
    days: GeneratedDay[];
    raw: unknown;
  },
): Promise<string | null> {
  const { error: deactivateError } = await admin
    .from("plans")
    .update({ is_active: false })
    .eq("is_active", true);

  if (deactivateError) return "Não deu para substituir o plano que está a dar.";

  const { data: plan, error: planError } = await admin
    .from("plans")
    .insert({
      name: input.name,
      block_start: new Date().toISOString().slice(0, 10),
      weeks: 4,
      equipment: input.equipment,
      source: input.source,
      rationale: input.rationale,
      raw_json: input.raw ?? null,
      is_active: true,
      created_by: input.createdBy,
    })
    .select("id")
    .single();

  if (planError || !plan) return "Não deu para criar o plano.";

  // The weekday a day falls on is decided here, not by whatever produced the
  // days: a template and a generated block are named the same way.
  const dayNames = trainingDayNames(input.days.length);

  for (const [index, day] of input.days.entries()) {
    const { data: planDay, error: dayError } = await admin
      .from("plan_days")
      .insert({
        plan_id: plan.id,
        day_index: index,
        name: dayNames[index] ?? `Dia ${index + 1}`,
        focus: day.focus,
      })
      .select("id")
      .single();

    if (dayError || !planDay) return "Não deu para criar um dia de treino.";

    const { error: itemError } = await admin.from("plan_items").insert(
      day.items.map((item, position) => ({
        plan_day_id: planDay.id,
        position,
        exercise: item.exercise,
        sets: item.sets,
        rep_low: item.rep_low,
        rep_high: item.rep_high,
        rest_sec: item.rest_sec,
        notes: item.notes ?? null,
      })),
    );

    if (itemError) return "Não deu para adicionar os exercícios.";
  }

  return null;
}

function templateAsDays(
  equipment: EquipmentProfile,
  daysPerWeek: number,
): GeneratedDay[] {
  return templateDays(equipment, daysPerWeek).map((day) => ({
    name: day.name,
    focus: day.focus,
    items: day.items.map((item) => ({
      exercise: item.exercise,
      sets: item.sets,
      rep_low: item.repLow,
      rep_high: item.repHigh,
      rest_sec: item.restSec,
      notes: item.notes,
    })),
  }));
}

/* ---------------------------------------------------------------- template */

/**
 * Replaces the active block with the built-in template for the current
 * settings. Writes go through the service role because programme rows are
 * shared by both members and are read-only under row level security.
 */
export async function buildTemplatePlan(
  _prev: PlanState,
  _formData: FormData,
): Promise<PlanState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "A sessão expirou. Entra outra vez.", source: null, notice: null };

  const { data: settings } = await supabase
    .from("household_settings")
    .select("days_per_week, equipment")
    .maybeSingle();

  if (!settings) return { error: "Faltam as definições.", source: null, notice: null };

  const failure = await persistPlan(createAdminClient(), {
    name: templateName(settings.equipment),
    rationale: templateRationale(settings.equipment, settings.days_per_week),
    equipment: settings.equipment,
    source: "template",
    createdBy: user.id,
    days: templateAsDays(settings.equipment, settings.days_per_week),
    raw: null,
  });

  if (failure) return { error: failure, source: null, notice: null };

  revalidatePath("/plan");
  revalidatePath("/");
  return { error: null, source: "template", notice: null };
}

/* --------------------------------------------------------------- tailored */

function ageFrom(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDelta = now.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age > 0 && age < 120 ? age : null;
}

/**
 * Builds a block tailored to both members. The model chooses the movements,
 * the order and the repetition ranges; the loads stay with the progression
 * engine. Anything the model returns is validated before it is stored, and a
 * failure falls back to the built-in template so the pair always has a plan.
 */
export async function generateTailoredPlan(
  _prev: PlanState,
  _formData: FormData,
): Promise<PlanState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "A sessão expirou. Entra outra vez.", source: null, notice: null };

  const { data: settings } = await supabase
    .from("household_settings")
    .select("days_per_week, equipment, session_minutes")
    .maybeSingle();

  if (!settings) return { error: "Faltam as definições.", source: null, notice: null };

  const admin = createAdminClient();

  const [{ data: profiles }, { data: exercises }, { data: activePlan }] =
    await Promise.all([
      admin
        .from("profiles")
        .select(
          "id, name, height_cm, birth_date, sex, experience, injury_notes, weight_goal_kg",
        )
        .order("created_at"),
      admin
        .from("exercises")
        .select("slug, name, primary_muscle, equipment, family, profiles_ok, is_timed, per_side"),
      admin
        .from("plans")
        .select("id, name")
        .eq("is_active", true)
        .maybeSingle(),
    ]);

  const catalogue: CatalogueEntry[] = (exercises ?? [])
    .filter((exercise) => exercise.profiles_ok.includes(settings.equipment))
    .map((exercise) => ({
      slug: exercise.slug,
      name: exercise.name,
      primary_muscle: exercise.primary_muscle,
      equipment: exercise.equipment,
      family: exercise.family,
      isTimed: exercise.is_timed,
      perSide: exercise.per_side,
    }));

  if (catalogue.length === 0) {
    return { error: "O catálogo de exercícios está vazio.", source: null, notice: null };
  }

  const memberIds = (profiles ?? []).map((profile) => profile.id);

  const [{ data: bodyLogs }, { data: progression }, { count: completedSessions }] =
    await Promise.all([
      admin
        .from("body_logs")
        .select("user_id, weight_kg, measured_on")
        .in("user_id", memberIds)
        .order("measured_on", { ascending: false }),
      admin
        .from("progression")
        .select("user_id, exercise, working_kg, fail_count")
        .in("user_id", memberIds),
      admin
        .from("sessions")
        .select("id", { count: "exact", head: true })
        .eq("status", "completed"),
    ]);

  const latestWeight = new Map<string, number>();
  for (const log of bodyLogs ?? []) {
    if (latestWeight.has(log.user_id) || log.weight_kg === null) continue;
    latestWeight.set(log.user_id, Number(log.weight_kg));
  }

  const members: MemberContext[] = (profiles ?? []).map((profile) => ({
    name: profile.name,
    heightCm: profile.height_cm === null ? null : Number(profile.height_cm),
    bodyWeightKg: latestWeight.get(profile.id) ?? null,
    age: ageFrom(profile.birth_date),
    sex: profile.sex,
    experience: profile.experience,
    injuryNotes: profile.injury_notes,
    weightGoalKg:
      profile.weight_goal_kg === null ? null : Number(profile.weight_goal_kg),
    lifts: (progression ?? [])
      .filter((row) => row.user_id === profile.id)
      .map((row) => ({
        exercise: row.exercise,
        workingKg: Number(row.working_kg),
        failCount: row.fail_count,
      })),
  }));

  // What the last plan actually prescribed, so the next one is not a copy.
  const { data: previousDays } = activePlan
    ? await admin.from("plan_days").select("id").eq("plan_id", activePlan.id)
    : { data: null };

  const { data: previousItems } = previousDays?.length
    ? await admin
        .from("plan_items")
        .select("exercise")
        .in(
          "plan_day_id",
          previousDays.map((day) => day.id),
        )
    : { data: null };

  const previousExercises = [
    ...new Set((previousItems ?? []).map((item) => item.exercise)),
  ];

  const stalledLifts = [
    ...new Set(
      (progression ?? [])
        .filter((row) => row.fail_count > 0)
        .map((row) => row.exercise),
    ),
  ];

  const prompt = buildPrompt({
    members,
    daysPerWeek: settings.days_per_week,
    sessionMinutes: settings.session_minutes,
    equipment: settings.equipment,
    catalogue,
    previousBlock: activePlan
      ? {
          name: activePlan.name,
          completedSessions: completedSessions ?? 0,
          stalledLifts,
          exercises: previousExercises,
        }
      : null,
  });

  const schema = planResponseSchema(catalogue.map((entry) => entry.slug));
  const problems: string[] = [];
  let accepted: { name: string; rationale: string; days: GeneratedDay[] } | null =
    null;
  let raw: unknown = null;

  for (let attempt = 0; attempt < 2 && accepted === null; attempt += 1) {
    const response = await generateJson<unknown>(prompt, schema);

    if (!response.ok) {
      problems.push(response.reason);
      continue;
    }

    const validation = validateGeneratedPlan(response.value, {
      expectedDays: settings.days_per_week,
      catalogue,
      sessionMinutes: settings.session_minutes,
    });

    if (validation.ok) {
      accepted = validation.plan;
      raw = response.value;
    } else {
      problems.push(validation.errors.slice(0, 3).join("; "));
    }
  }

  const usingTemplate = accepted === null;

  const failure = await persistPlan(admin, {
    name: accepted?.name ?? templateName(settings.equipment),
    rationale:
      accepted?.rationale ??
      templateRationale(settings.equipment, settings.days_per_week),
    equipment: settings.equipment,
    source: usingTemplate ? "template" : "generated",
    createdBy: user.id,
    days:
      accepted?.days ??
      templateAsDays(settings.equipment, settings.days_per_week),
    raw,
  });

  if (failure) return { error: failure, source: null, notice: null };

  revalidatePath("/plan");
  revalidatePath("/");

  if (usingTemplate) {
    const reason =
      problems[0] === "no_api_key" ? "não está configurada" : "não estava disponível";
    return {
      error: null,
      source: "template",
      notice: `A criação personalizada ${reason}, por isso foi usado o programa padrão.`,
    };
  }

  return { error: null, source: "generated", notice: null };
}
