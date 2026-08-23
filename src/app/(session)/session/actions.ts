"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  defaultPrescription,
  estimatedOneRepMax,
  nextWorkingWeight,
  warmupSets,
} from "@/lib/progression";
import type { LiftFamily } from "@/lib/database.types";

/**
 * Starts today's session for a training day.
 *
 * The session takes a snapshot of what it prescribes (session_items) instead
 * of reading the shared programme as it goes, so rebuilding the block does not
 * disturb a workout in progress and either member can add or drop an exercise
 * without touching what both of them follow.
 */
export async function startSession(formData: FormData) {
  const planDayId = String(formData.get("plan_day_id") ?? "");
  if (!planDayId) redirect("/");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const today = new Date().toISOString().slice(0, 10);

  const { data: existing } = await supabase
    .from("sessions")
    .select("id")
    .eq("user_id", user.id)
    .eq("performed_on", today)
    .eq("status", "in_progress")
    .maybeSingle();

  if (existing) redirect(`/session/${existing.id}`);

  const { data: items } = await supabase
    .from("plan_items")
    .select("position, exercise, sets, rep_low, rep_high, rest_sec, notes")
    .eq("plan_day_id", planDayId)
    .order("position");

  if (!items || items.length === 0) redirect("/plan");

  const slugs = [...new Set(items.map((item) => item.exercise))];

  const [{ data: exercises }, { data: progression }] = await Promise.all([
    supabase.from("exercises").select("slug, family").in("slug", slugs),
    supabase
      .from("progression")
      .select("exercise, working_kg")
      .eq("user_id", user.id)
      .in("exercise", slugs),
  ]);

  const familyBySlug = new Map(
    exercises?.map((exercise) => [exercise.slug, exercise.family]) ?? [],
  );
  const workingBySlug = new Map(
    progression?.map((row) => [row.exercise, Number(row.working_kg)]) ?? [],
  );

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .insert({ user_id: user.id, plan_day_id: planDayId, performed_on: today })
    .select("id")
    .single();

  if (sessionError || !session) redirect("/");

  await supabase.from("session_items").insert(
    items.map((item, position) => ({
      session_id: session.id,
      user_id: user.id,
      position,
      exercise: item.exercise,
      sets: item.sets,
      rep_low: item.rep_low,
      rep_high: item.rep_high,
      rest_sec: item.rest_sec,
      notes: item.notes,
    })),
  );

  const rows = items.flatMap((item) =>
    setRowsFor({
      sessionId: session.id,
      userId: user.id,
      exercise: item.exercise,
      family: familyBySlug.get(item.exercise) as LiftFamily | undefined,
      working: workingBySlug.get(item.exercise) ?? 0,
      sets: item.sets,
    }),
  );

  await supabase.from("set_logs").insert(rows);

  redirect(`/session/${session.id}`);
}

/** Warm-up rows plus working rows for one exercise. */
function setRowsFor(input: {
  sessionId: string;
  userId: string;
  exercise: string;
  family: LiftFamily | undefined;
  working: number;
  sets: number;
}) {
  const loaded = input.family !== "bodyweight" && input.working > 0;
  const rows: Array<{
    session_id: string;
    user_id: string;
    exercise: string;
    set_no: number;
    is_warmup: boolean;
    target_kg: number | null;
    completed: boolean;
  }> = [];

  if (loaded) {
    warmupSets(input.working).forEach((warmup, index) => {
      rows.push({
        session_id: input.sessionId,
        user_id: input.userId,
        exercise: input.exercise,
        set_no: index + 1,
        is_warmup: true,
        target_kg: warmup.kg,
        completed: false,
      });
    });
  }

  for (let setNo = 1; setNo <= input.sets; setNo += 1) {
    rows.push({
      session_id: input.sessionId,
      user_id: input.userId,
      exercise: input.exercise,
      set_no: setNo,
      is_warmup: false,
      target_kg: loaded ? input.working : null,
      completed: false,
    });
  }

  return rows;
}

export type LogSetResult = { ok: boolean };

/** Records one set. Called as each set is ticked off. */
export async function logSet(input: {
  setLogId: string;
  weightKg: number | null;
  reps: number | null;
  completed: boolean;
}): Promise<LogSetResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { error } = await supabase
    .from("set_logs")
    .update({
      weight_kg: input.weightKg,
      reps: input.reps,
      completed: input.completed,
      logged_at: new Date().toISOString(),
    })
    .eq("id", input.setLogId)
    .eq("user_id", user.id);

  return { ok: !error };
}

export type MutateSessionResult = { ok: boolean; error: string | null };

/** Adds an exercise to a session already under way. */
export async function addExerciseToSession(input: {
  sessionId: string;
  exercise: string;
}): Promise<MutateSessionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "A sessão expirou." };

  const { data: session } = await supabase
    .from("sessions")
    .select("id, status")
    .eq("id", input.sessionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!session || session.status !== "in_progress") {
    return { ok: false, error: "Este treino já não está a decorrer." };
  }

  const { data: exercise } = await supabase
    .from("exercises")
    .select("slug, family")
    .eq("slug", input.exercise)
    .maybeSingle();

  if (!exercise) return { ok: false, error: "Exercício desconhecido." };

  const { data: current } = await supabase
    .from("session_items")
    .select("exercise, position")
    .eq("session_id", input.sessionId)
    .order("position");

  if (current?.some((item) => item.exercise === input.exercise)) {
    return { ok: false, error: "Esse exercício já está no treino." };
  }

  const { data: progression } = await supabase
    .from("progression")
    .select("working_kg")
    .eq("user_id", user.id)
    .eq("exercise", input.exercise)
    .maybeSingle();

  const prescription = defaultPrescription(exercise.family as LiftFamily);
  const position = (current?.[current.length - 1]?.position ?? -1) + 1;

  const { error: itemError } = await supabase.from("session_items").insert({
    session_id: input.sessionId,
    user_id: user.id,
    position,
    exercise: input.exercise,
    sets: prescription.sets,
    rep_low: prescription.repLow,
    rep_high: prescription.repHigh,
    rest_sec: prescription.restSec,
    added_mid_session: true,
  });

  if (itemError) return { ok: false, error: "Não foi possível adicionar." };

  const { error: setsError } = await supabase.from("set_logs").insert(
    setRowsFor({
      sessionId: input.sessionId,
      userId: user.id,
      exercise: input.exercise,
      family: exercise.family as LiftFamily,
      working: Number(progression?.working_kg ?? 0),
      sets: prescription.sets,
    }),
  );

  if (setsError) return { ok: false, error: "Não foi possível criar as séries." };

  return { ok: true, error: null };
}

/** Drops an exercise from a session already under way. */
export async function removeExerciseFromSession(input: {
  sessionId: string;
  exercise: string;
}): Promise<MutateSessionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "A sessão expirou." };

  const { count } = await supabase
    .from("session_items")
    .select("id", { count: "exact", head: true })
    .eq("session_id", input.sessionId)
    .eq("user_id", user.id);

  if ((count ?? 0) <= 1) {
    return { ok: false, error: "Um treino tem de ter pelo menos um exercício." };
  }

  await supabase
    .from("set_logs")
    .delete()
    .eq("session_id", input.sessionId)
    .eq("user_id", user.id)
    .eq("exercise", input.exercise);

  const { error } = await supabase
    .from("session_items")
    .delete()
    .eq("session_id", input.sessionId)
    .eq("user_id", user.id)
    .eq("exercise", input.exercise);

  if (error) return { ok: false, error: "Não foi possível remover." };

  return { ok: true, error: null };
}

/**
 * Closes the session: applies the progression rules to every exercise trained,
 * records any personal record, and marks the session complete.
 */
export async function finishSession(formData: FormData) {
  const sessionId = String(formData.get("session_id") ?? "");
  if (!sessionId) redirect("/");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: session } = await supabase
    .from("sessions")
    .select("id, started_at, status")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!session) redirect("/");
  if (session.status === "completed") redirect(`/session/${sessionId}/summary`);

  const { data: logs } = await supabase
    .from("set_logs")
    .select("exercise, set_no, is_warmup, weight_kg, reps, completed")
    .eq("session_id", sessionId)
    .eq("user_id", user.id);

  const working = (logs ?? []).filter((log) => !log.is_warmup);
  const slugs = [...new Set(working.map((log) => log.exercise))];

  const [{ data: exercises }, { data: items }, { data: progression }, { data: records }] =
    await Promise.all([
      supabase
        .from("exercises")
        .select("slug, family, increment_kg")
        .in("slug", slugs),
      supabase
        .from("session_items")
        .select("exercise, rep_low")
        .eq("session_id", sessionId),
      supabase
        .from("progression")
        .select("exercise, working_kg, fail_count")
        .eq("user_id", user.id)
        .in("exercise", slugs),
      supabase
        .from("personal_records")
        .select("exercise, estimated_1rm")
        .eq("user_id", user.id)
        .in("exercise", slugs),
    ]);

  const exerciseBySlug = new Map(
    exercises?.map((exercise) => [exercise.slug, exercise]) ?? [],
  );
  const targetRepsBySlug = new Map(
    items?.map((item) => [item.exercise, item.rep_low]) ?? [],
  );
  const progressionBySlug = new Map(
    progression?.map((row) => [row.exercise, row]) ?? [],
  );
  const bestBySlug = new Map<string, number>();
  for (const record of records ?? []) {
    const current = bestBySlug.get(record.exercise) ?? 0;
    bestBySlug.set(
      record.exercise,
      Math.max(current, Number(record.estimated_1rm)),
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const progressionRows = [];
  const recordRows = [];

  for (const slug of slugs) {
    const exercise = exerciseBySlug.get(slug);
    if (!exercise) continue;

    const sets = working
      .filter((log) => log.exercise === slug)
      .map((log) => ({
        reps: log.reps ?? 0,
        targetReps: targetRepsBySlug.get(slug) ?? 0,
        completed: log.completed,
      }));

    if (sets.length === 0) continue;

    const attempted = sets.some((set) => set.completed);
    if (!attempted) continue;

    const current = progressionBySlug.get(slug);
    const heaviest = working
      .filter((log) => log.exercise === slug && log.completed)
      .reduce((max, log) => Math.max(max, Number(log.weight_kg ?? 0)), 0);

    const outcome = nextWorkingWeight({
      family: exercise.family as LiftFamily,
      increment: Number(exercise.increment_kg),
      workingKg: Number(current?.working_kg ?? heaviest),
      failCount: current?.fail_count ?? 0,
      sets,
    });

    progressionRows.push({
      user_id: user.id,
      exercise: slug,
      working_kg: outcome.workingKg,
      fail_count: outcome.failCount,
      last_action: outcome.action,
      updated_at: new Date().toISOString(),
    });

    const best = working
      .filter((log) => log.exercise === slug && log.completed)
      .reduce(
        (top, log) => {
          const estimate = estimatedOneRepMax(
            Number(log.weight_kg ?? 0),
            log.reps ?? 0,
          );
          return estimate > top.estimate
            ? {
                estimate,
                weight: Number(log.weight_kg ?? 0),
                reps: log.reps ?? 0,
              }
            : top;
        },
        { estimate: 0, weight: 0, reps: 0 },
      );

    if (best.estimate > (bestBySlug.get(slug) ?? 0) && best.weight > 0) {
      recordRows.push({
        user_id: user.id,
        exercise: slug,
        weight_kg: best.weight,
        reps: best.reps,
        estimated_1rm: best.estimate,
        achieved_on: today,
      });
    }
  }

  if (progressionRows.length > 0) {
    await supabase
      .from("progression")
      .upsert(progressionRows, { onConflict: "user_id,exercise" });
  }

  if (recordRows.length > 0) {
    await supabase
      .from("personal_records")
      .upsert(recordRows, { onConflict: "user_id,exercise,achieved_on" });
  }

  await supabase
    .from("sessions")
    .update({ status: "completed", ended_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("user_id", user.id);

  revalidatePath("/");
  revalidatePath("/progress");
  redirect(`/session/${sessionId}/summary`);
}

/** Abandons an in-progress session without applying any progression. */
export async function abandonSession(formData: FormData) {
  const sessionId = String(formData.get("session_id") ?? "");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase
    .from("sessions")
    .update({ status: "abandoned", ended_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("user_id", user.id);

  revalidatePath("/");
  redirect("/");
}
