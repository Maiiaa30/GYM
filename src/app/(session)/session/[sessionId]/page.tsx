import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { describeTarget } from "@/lib/progression";
import type { LiftFamily, ProgressionAction } from "@/lib/database.types";
import { SessionRunner, type RunnerExercise } from "./runner";

export const dynamic = "force-dynamic";

export default async function SessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: session } = await supabase
    .from("sessions")
    .select("id, plan_day_id, status, performed_on")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!session) notFound();
  if (session.status === "completed") redirect(`/session/${sessionId}/summary`);

  const [{ data: day }, { data: items }, { data: logs }] = await Promise.all([
    supabase
      .from("plan_days")
      .select("id, name, focus")
      .eq("id", session.plan_day_id ?? "")
      .maybeSingle(),
    supabase
      .from("session_items")
      .select("position, exercise, sets, rep_low, rep_high, rest_sec, notes, added_mid_session")
      .eq("session_id", sessionId)
      .order("position"),
    supabase
      .from("set_logs")
      .select("id, exercise, set_no, is_warmup, target_kg, weight_kg, reps, completed")
      .eq("session_id", sessionId)
      .eq("user_id", user.id)
      .order("is_warmup", { ascending: false })
      .order("set_no"),
  ]);

  if (!items || items.length === 0) redirect("/plan");

  const slugs = items.map((item) => item.exercise);

  const [
    { data: exercises },
    { data: progression },
    { data: history },
    { data: partnerLogs },
    { data: members },
    { data: settings },
    { data: todayWeight },
  ] = await Promise.all([
    supabase
      .from("exercises")
      .select("slug, name, primary_muscle, images, cues, family, increment_kg")
      .in("slug", slugs),
    supabase
      .from("progression")
      .select("exercise, working_kg, last_action")
      .eq("user_id", user.id)
      .in("exercise", slugs),
    supabase
      .from("set_logs")
      .select("exercise, weight_kg, reps, logged_at")
      .eq("user_id", user.id)
      .in("exercise", slugs)
      .eq("completed", true)
      .eq("is_warmup", false)
      .neq("session_id", sessionId)
      .order("logged_at", { ascending: false })
      .limit(150),
    supabase
      .from("set_logs")
      .select("exercise, weight_kg, reps, user_id")
      .neq("user_id", user.id)
      .in("exercise", slugs)
      .eq("completed", true)
      .eq("is_warmup", false),
    supabase.from("profiles").select("id, name").neq("id", user.id),
    supabase.from("household_settings").select("equipment").maybeSingle(),
    supabase
      .from("body_logs")
      .select("weight_kg")
      .eq("user_id", user.id)
      .eq("measured_on", new Date().toISOString().slice(0, 10))
      .maybeSingle(),
  ]);

  // The library offered when adding an exercise mid-session: everything that
  // suits the current equipment and is not already part of this workout.
  const { data: catalogue } = await supabase
    .from("exercises")
    .select("slug, name, primary_muscle, profiles_ok")
    .order("name");

  const available = (catalogue ?? [])
    .filter(
      (exercise) =>
        !slugs.includes(exercise.slug) &&
        (!settings || exercise.profiles_ok.includes(settings.equipment)),
    )
    .map((exercise) => ({
      slug: exercise.slug,
      name: exercise.name,
      muscle: exercise.primary_muscle,
    }));

  const partnerName = members?.[0]?.name ?? null;
  const exerciseBySlug = new Map(
    exercises?.map((exercise) => [exercise.slug, exercise]) ?? [],
  );
  const progressionBySlug = new Map(
    progression?.map((row) => [row.exercise, row]) ?? [],
  );

  const lastBySlug = new Map<
    string,
    { weightKg: number | null; reps: number | null; on: string }
  >();
  for (const entry of history ?? []) {
    if (lastBySlug.has(entry.exercise)) continue;
    lastBySlug.set(entry.exercise, {
      weightKg: entry.weight_kg === null ? null : Number(entry.weight_kg),
      reps: entry.reps,
      on: entry.logged_at.slice(0, 10),
    });
  }

  const partnerBySlug = new Map<
    string,
    { weightKg: number | null; reps: number | null }
  >();
  for (const entry of partnerLogs ?? []) {
    if (partnerBySlug.has(entry.exercise)) continue;
    partnerBySlug.set(entry.exercise, {
      weightKg: entry.weight_kg === null ? null : Number(entry.weight_kg),
      reps: entry.reps,
    });
  }

  const runnerExercises: RunnerExercise[] = items.map((item) => {
    const exercise = exerciseBySlug.get(item.exercise);
    const family = (exercise?.family ?? "accessory") as LiftFamily;
    const progress = progressionBySlug.get(item.exercise);
    const partner = partnerBySlug.get(item.exercise);

    return {
      slug: item.exercise,
      name: exercise?.name ?? item.exercise,
      muscle: exercise?.primary_muscle ?? "",
      images: exercise?.images ?? [],
      cues: exercise?.cues ?? [],
      family,
      increment: Number(exercise?.increment_kg ?? 2.5),
      repLow: item.rep_low,
      repHigh: item.rep_high,
      restSec: item.rest_sec,
      notes: item.notes,
      addedMidSession: item.added_mid_session,
      reason: describeTarget({
        action: (progress?.last_action ?? null) as ProgressionAction | null,
        increment: Number(exercise?.increment_kg ?? 2.5),
        family,
        hasHistory: Boolean(progress) || lastBySlug.has(item.exercise),
      }),
      last: lastBySlug.get(item.exercise) ?? null,
      partner: partner ? { name: partnerName, ...partner } : null,
      sets: (logs ?? [])
        .filter((log) => log.exercise === item.exercise)
        .map((log) => ({
          id: log.id,
          setNo: log.set_no,
          isWarmup: log.is_warmup,
          targetKg: log.target_kg === null ? null : Number(log.target_kg),
          weightKg: log.weight_kg === null ? null : Number(log.weight_kg),
          reps: log.reps,
          completed: log.completed,
        })),
    };
  });

  return (
    <SessionRunner
      sessionId={sessionId}
      dayName={day?.name ?? "Treino"}
      focus={day?.focus ?? null}
      exercises={runnerExercises}
      available={available}
      needsBodyWeight={!todayWeight}
    />
  );
}
