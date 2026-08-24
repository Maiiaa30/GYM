"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { today as todayInGym } from "@/lib/clock";
import {
  defaultPrescription,
  estimatedOneRepMax,
  nextWorkingWeight,
  warmupSets,
} from "@/lib/progression";
import { groupForPairing, pairMembers } from "@/lib/blocks";
import { pickAlternative, swapDay, type SwapCandidate } from "@/lib/swap";
import { sendToPartnerOf } from "@/lib/push";
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

  const today = todayInGym();

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
    .select("position, exercise, sets, rep_low, rep_high, rest_sec, notes, superset_group")
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
      superset_group: item.superset_group,
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

/**
 * Starts a session with no programme behind it: exercises are chosen as you
 * go. Each one still arrives with the weight you worked up to.
 */
export async function startFreestyleSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const today = todayInGym();

  const { data: existing } = await supabase
    .from("sessions")
    .select("id")
    .eq("user_id", user.id)
    .eq("performed_on", today)
    .eq("status", "in_progress")
    .maybeSingle();

  if (existing) redirect(`/session/${existing.id}`);

  const { data: session, error } = await supabase
    .from("sessions")
    .insert({ user_id: user.id, plan_day_id: null, performed_on: today })
    .select("id")
    .single();

  if (error || !session) redirect("/");

  redirect(`/session/${session.id}`);
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

/**
 * The caller's own session, and only while it is still running.
 *
 * Every mutation goes through this. Without it a finished session could be
 * rewritten after the fact — its sets replaced by an exercise nobody did,
 * while the progression computed at the time stayed as it was — and a session
 * id belonging to somebody else was accepted and silently did nothing.
 */
async function assertOpenSession(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessionId: string,
  userId: string,
): Promise<string | null> {
  const { data: session } = await supabase
    .from("sessions")
    .select("id, status")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!session) return "Este treino não existe.";
  if (session.status !== "in_progress") {
    return "Este treino já não está a decorrer.";
  }
  return null;
}

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

  const closed = await assertOpenSession(supabase, input.sessionId, user.id);
  if (closed) return { ok: false, error: closed };

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
    return { ok: false, error: "Esse exercício já está no treino de hoje." };
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

  if (itemError) return { ok: false, error: "Não deu para adicionar." };

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

  if (setsError) return { ok: false, error: "Não deu para criar as séries." };

  return { ok: true, error: null };
}

/**
 * Pairs an exercise with the one above it into a superset: they are then
 * worked through back to back, with one rest at the end of each round.
 */
export async function pairWithPrevious(input: {
  sessionId: string;
  exercise: string;
}): Promise<MutateSessionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "A sessão expirou." };

  const closed = await assertOpenSession(supabase, input.sessionId, user.id);
  if (closed) return { ok: false, error: closed };

  const { data: items } = await supabase
    .from("session_items")
    .select("exercise, position, superset_group")
    .eq("session_id", input.sessionId)
    .eq("user_id", user.id)
    .order("position");

  const groupable = (items ?? []).map((item) => ({
    exercise: item.exercise,
    position: item.position,
    supersetGroup: item.superset_group,
  }));

  const group = groupForPairing(groupable, input.exercise);
  if (group === null) {
    return { ok: false, error: "Não há nenhum exercício acima deste para juntar." };
  }

  const members = pairMembers(groupable, input.exercise);

  const { error } = await supabase
    .from("session_items")
    .update({ superset_group: group })
    .eq("session_id", input.sessionId)
    .eq("user_id", user.id)
    .in("exercise", members);

  if (error) return { ok: false, error: "Não deu para juntar." };

  return { ok: true, error: null };
}

/** Takes an exercise back out of its superset. */
export async function unpairExercise(input: {
  sessionId: string;
  exercise: string;
}): Promise<MutateSessionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "A sessão expirou." };

  const closed = await assertOpenSession(supabase, input.sessionId, user.id);
  if (closed) return { ok: false, error: closed };

  const { error } = await supabase
    .from("session_items")
    .update({ superset_group: null })
    .eq("session_id", input.sessionId)
    .eq("user_id", user.id)
    .eq("exercise", input.exercise);

  if (error) return { ok: false, error: "Não deu para separar." };

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

  const closed = await assertOpenSession(supabase, input.sessionId, user.id);
  if (closed) return { ok: false, error: closed };

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

  if (error) return { ok: false, error: "Não deu para remover." };

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
        .select("exercise, rep_low, rep_high")
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
  // The top of the range: the weight only moves once the whole range is done.
  const targetRepsBySlug = new Map(
    items?.map((item) => [item.exercise, item.rep_high]) ?? [],
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

  const today = todayInGym();
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

  // The point of training as a pair: the other one hears about it. Nothing is
  // said that they could not already read, and a push service having a bad day
  // must never cost somebody their session, so this is best effort and the
  // redirect does not wait on it.
  const { data: me } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", user.id)
    .maybeSingle();

  const firstName = me?.name?.split(" ")[0] ?? "O teu parceiro";
  await sendToPartnerOf(user.id, {
    title: "GYM",
    body: `${firstName} acabou de treinar.`,
    url: "/",
    tag: "trained",
  }).catch(() => {
    // Never let a notification stand between somebody and their summary.
  });

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


/* ------------------------------------------------------------- swapping */

/**
 * The catalogue this pair can actually use today, and which of the session's
 * exercises have already been worked.
 */
async function swapContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessionId: string,
  userId: string,
) {
  const [{ data: items }, { data: logs }, { data: settings }] = await Promise.all([
    supabase
      .from("session_items")
      .select("position, exercise, swapped_from")
      .eq("session_id", sessionId)
      .eq("user_id", userId)
      .order("position"),
    supabase
      .from("set_logs")
      .select("exercise, completed")
      .eq("session_id", sessionId)
      .eq("user_id", userId),
    supabase.from("household_settings").select("equipment").maybeSingle(),
  ]);

  const { data: exercises } = await supabase
    .from("exercises")
    .select("slug, primary_muscle, family, profiles_ok");

  const catalogue: SwapCandidate[] = (exercises ?? [])
    .filter(
      (exercise) => !settings || exercise.profiles_ok.includes(settings.equipment),
    )
    .map((exercise) => ({
      slug: exercise.slug,
      muscle: exercise.primary_muscle,
      family: exercise.family as LiftFamily,
    }));

  const touched = new Set(
    (logs ?? []).filter((log) => log.completed).map((log) => log.exercise),
  );

  return { items: items ?? [], catalogue, touched };
}

/** Replaces one exercise's rows, keeping its prescription and its position. */
async function replaceExercise(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: { sessionId: string; userId: string; from: string; to: string },
) {
  const [{ data: item }, { data: exercise }, { data: progress }] =
    await Promise.all([
      supabase
        .from("session_items")
        .select("id, sets, swapped_from")
        .eq("session_id", input.sessionId)
        .eq("exercise", input.from)
        .maybeSingle(),
      supabase
        .from("exercises")
        .select("slug, family")
        .eq("slug", input.to)
        .maybeSingle(),
      supabase
        .from("progression")
        .select("working_kg")
        .eq("user_id", input.userId)
        .eq("exercise", input.to)
        .maybeSingle(),
    ]);

  if (!item || !exercise) return false;

  await supabase
    .from("set_logs")
    .delete()
    .eq("session_id", input.sessionId)
    .eq("user_id", input.userId)
    .eq("exercise", input.from);

  // The slot remembers what it has turned down, so swapping again moves on
  // instead of handing back the rack you just walked away from.
  await supabase
    .from("session_items")
    .update({
      exercise: input.to,
      swapped_from: [...new Set([...(item.swapped_from ?? []), input.from])],
    })
    .eq("id", item.id);

  // The replacement arrives at the weight already reached on it, exactly as it
  // would have done had it been in the plan from the start.
  await supabase.from("set_logs").insert(
    setRowsFor({
      sessionId: input.sessionId,
      userId: input.userId,
      exercise: input.to,
      family: exercise.family as LiftFamily,
      working: Number(progress?.working_kg ?? 0),
      sets: item.sets,
    }),
  );

  return true;
}

/** Swaps one exercise for another that works the same muscle. */
export async function swapExerciseInSession(input: {
  sessionId: string;
  exercise: string;
}): Promise<MutateSessionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "A sessão expirou." };

  const closed = await assertOpenSession(supabase, input.sessionId, user.id);
  if (closed) return { ok: false, error: closed };

  const { items, catalogue, touched } = await swapContext(
    supabase,
    input.sessionId,
    user.id,
  );

  if (touched.has(input.exercise)) {
    return {
      ok: false,
      error: "Já fizeste séries neste exercício. Remove-o em vez de o trocar.",
    };
  }

  const current = catalogue.find((entry) => entry.slug === input.exercise);
  if (!current) return { ok: false, error: "Exercício desconhecido." };

  const slot = items.find((item) => item.exercise === input.exercise);
  const inSession = items.map((item) => item.exercise);
  const rejected = slot?.swapped_from ?? [];

  // Once every alternative has been turned down, start the list again rather
  // than telling them there is nothing left.
  const alternative =
    pickAlternative({
      current,
      catalogue,
      exclude: [...inSession, ...rejected],
    }) ?? pickAlternative({ current, catalogue, exclude: inSession });

  if (!alternative) {
    return {
      ok: false,
      error: "Não há outro exercício para esse músculo com o teu equipamento.",
    };
  }

  const ok = await replaceExercise(supabase, {
    sessionId: input.sessionId,
    userId: user.id,
    from: input.exercise,
    to: alternative.slug,
  });

  if (!ok) return { ok: false, error: "Não deu para trocar." };

  revalidatePath(`/session/${input.sessionId}`);
  return { ok: true, error: null };
}

/**
 * Swaps every exercise not yet started, for the day you look at the workout
 * and do not want to do it, or walk in and half the room is taken.
 */
export async function swapWholeSession(input: {
  sessionId: string;
}): Promise<MutateSessionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "A sessão expirou." };

  const closed = await assertOpenSession(supabase, input.sessionId, user.id);
  if (closed) return { ok: false, error: closed };

  const { items, catalogue, touched } = await swapContext(
    supabase,
    input.sessionId,
    user.id,
  );

  const swaps = swapDay({
    items: items.map((item) => ({
      position: item.position,
      slug: item.exercise,
      touched: touched.has(item.exercise),
      rejected: item.swapped_from ?? [],
    })),
    catalogue,
  });

  if (swaps.length === 0) {
    return {
      ok: false,
      error: "Não há por onde trocar: não existem alternativas com o teu equipamento.",
    };
  }

  for (const swap of swaps) {
    await replaceExercise(supabase, {
      sessionId: input.sessionId,
      userId: user.id,
      from: swap.from,
      to: swap.to,
    });
  }

  revalidatePath(`/session/${input.sessionId}`);
  return { ok: true, error: null };
}
