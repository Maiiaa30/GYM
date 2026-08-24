import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { describeTarget } from "@/lib/progression";
import { buildBlocks } from "@/lib/blocks";
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
      .select("position, exercise, sets, rep_low, rep_high, rest_sec, notes, added_mid_session, superset_group")
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

  // A session built from a training day must have exercises; a freestyle one
  // starts empty on purpose and is filled as it goes.
  const freestyle = session.plan_day_id === null;
  if ((!items || items.length === 0) && !freestyle) redirect("/plan");

  const slugs = (items ?? []).map((item) => item.exercise);

  const [
    { data: exercises },
    { data: progression },
    { data: history },
    { data: partnerLogs },
    { data: members },
    { data: settings },
    { data: todayWeight },
  ] = await Promise.all([
    slugs.length > 0
      ? supabase
          .from("exercises")
          .select(
            "slug, name, primary_muscle, images, cues, family, increment_kg, is_timed, per_side",
          )
          .in("slug", slugs)
      : Promise.resolve({ data: [] as never[] }),
    slugs.length > 0
      ? supabase
          .from("progression")
          .select("exercise, working_kg, last_action")
          .eq("user_id", user.id)
          .in("exercise", slugs)
      : Promise.resolve({ data: [] as never[] }),
    slugs.length > 0
      ? supabase
          .from("set_logs")
          .select("exercise, weight_kg, reps, logged_at, session_id")
          .eq("user_id", user.id)
          .in("exercise", slugs)
      .eq("completed", true)
      .eq("is_warmup", false)
          .neq("session_id", sessionId)
          .order("logged_at", { ascending: false })
          .limit(150)
      : Promise.resolve({ data: [] as never[] }),
    slugs.length > 0
      ? supabase
          .from("set_logs")
          .select("exercise, weight_kg, reps, user_id")
          .neq("user_id", user.id)
          .in("exercise", slugs)
          .eq("completed", true)
          .eq("is_warmup", false)
      : Promise.resolve({ data: [] as never[] }),
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
  const lastSessionBySlug = new Map<string, string>();
  for (const entry of history ?? []) {
    if (lastBySlug.has(entry.exercise)) continue;
    lastBySlug.set(entry.exercise, {
      weightKg: entry.weight_kg === null ? null : Number(entry.weight_kg),
      reps: entry.reps,
      on: entry.logged_at.slice(0, 10),
    });
    lastSessionBySlug.set(entry.exercise, entry.session_id);
  }

  // Whether the last time out finished every set at the top of the range.
  // For work that carries no load that is the signal to add a set rather than
  // another repetition.
  const hitCeiling = (slug: string, repHigh: number) => {
    const lastSession = lastSessionBySlug.get(slug);
    if (!lastSession) return false;
    const sets = (history ?? []).filter(
      (entry) => entry.exercise === slug && entry.session_id === lastSession,
    );
    return sets.length > 0 && sets.every((entry) => (entry.reps ?? 0) >= repHigh);
  };

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

  const runnerExercises: RunnerExercise[] = (items ?? []).map((item) => {
    const exercise = exerciseBySlug.get(item.exercise);
    const family = (exercise?.family ?? "accessory") as LiftFamily;
    const progress = progressionBySlug.get(item.exercise);
    const partner = partnerBySlug.get(item.exercise);

    const timed = Boolean(exercise?.is_timed);
    const unloaded = timed || family === "bodyweight";
    const ceiling = unloaded && hitCeiling(item.exercise, item.rep_high);

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
      position: item.position,
      supersetGroup: item.superset_group,
      isTimed: timed,
      perSide: Boolean(exercise?.per_side),
      reason: describeTarget({
        action: (progress?.last_action ?? null) as ProgressionAction | null,
        increment: Number(exercise?.increment_kg ?? 2.5),
        family,
        hasHistory: Boolean(progress) || lastBySlug.has(item.exercise),
        isTimed: timed,
        hitCeiling: ceiling,
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

  const blocks = buildBlocks(runnerExercises, (item) => item.slug).map((block) => ({
    key: block.key,
    group: block.group,
    exercises: block.items,
  }));

  return (
    <SessionRunner
      sessionId={sessionId}
      dayName={freestyle ? "Treino livre" : (day?.name ?? "Treino")}
      focus={freestyle ? "Exercícios à escolha" : (day?.focus ?? null)}
      blocks={blocks}
      available={available}
      needsBodyWeight={!todayWeight}
    />
  );
}
