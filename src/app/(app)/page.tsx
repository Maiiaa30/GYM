import { redirect } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import {
  formatVolume,
  minutesBetween,
  relativeDay,
  trainedThisWeek,
  volumeOf,
  weekDays,
  weekStart,
  weekStreak,
} from "@/lib/home";
import { estimateMinutes } from "@/lib/duration";
import { suggestedDayIndex } from "@/lib/schedule";
import { buildHeatmap, toISODate } from "@/lib/charts";
import { countSetsByMuscle, muscleBalance, untrained } from "@/lib/muscle-volume";
import { TodayCard, type TodayDay } from "./today-card";
import {
  ActivityCard,
  EmptyCard,
  LastSessionCard,
  MusclesCard,
  PartnerCard,
  StatRow,
  WeekCard,
  WeightCard,
  type LastSession,
} from "./home-cards";

export const dynamic = "force-dynamic";

function todayLabel() {
  return new Date().toLocaleDateString("pt-PT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export default async function TodayPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const today = new Date().toISOString().slice(0, 10);

  const [{ data: profile }, { data: plan }, { data: settings }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("name, weight_goal_kg")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("plans")
        .select("id, name")
        .eq("is_active", true)
        .maybeSingle(),
      supabase
        .from("household_settings")
        .select("days_per_week")
        .maybeSingle(),
    ]);

  const { data: days } = plan
    ? await supabase
        .from("plan_days")
        .select("id, day_index, name, focus")
        .eq("plan_id", plan.id)
        .order("day_index")
    : { data: null };

  // Enough history for the week strip and a streak worth reading, without
  // pulling a year of sessions onto the opening screen.
  const since = new Date(Date.now() - 120 * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const [
    { data: history },
    { data: openSession },
    { data: members },
    { data: bodyLogs },
  ] = await Promise.all([
    supabase
      .from("sessions")
      .select("id, plan_day_id, performed_on, started_at, ended_at")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .gte("performed_on", since)
      .order("performed_on", { ascending: false }),
    supabase
      .from("sessions")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "in_progress")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("profiles").select("id, name").neq("id", user.id),
    supabase
      .from("body_logs")
      .select("measured_on, weight_kg")
      .eq("user_id", user.id)
      .not("weight_kg", "is", null)
      .order("measured_on", { ascending: false })
      .limit(30),
  ]);

  const heatmapFrom = toISODate(new Date(Date.now() - 90 * 86_400_000));

  const [{ data: recentSets }, { data: weekRecords }, { data: allExercises }] =
    await Promise.all([
    supabase
      .from("set_logs")
      .select("exercise, weight_kg, reps, logged_at")
      .eq("user_id", user.id)
      .eq("completed", true)
      .eq("is_warmup", false)
      .gte("logged_at", heatmapFrom)
      .order("logged_at", { ascending: false }),
    supabase
      .from("personal_records")
      .select("id, achieved_on")
      .eq("user_id", user.id)
      .gte("achieved_on", weekStart(today)),
    supabase.from("exercises").select("slug, primary_muscle"),
  ]);

  const { count: completedCount } = await supabase
    .from("sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "completed");

  const { data: items } = days?.length
    ? await supabase
        .from("plan_items")
        .select("plan_day_id, position, exercise, sets, rep_low, rep_high, rest_sec")
        .in(
          "plan_day_id",
          days.map((day) => day.id),
        )
        .order("position")
    : { data: null };

  const { data: exercises } = items?.length
    ? await supabase
        .from("exercises")
        .select("slug, name, family, is_timed")
        .in("slug", [...new Set(items.map((item) => item.exercise))])
    : { data: null };

  const exerciseBySlug = new Map(
    exercises?.map((exercise) => [exercise.slug, exercise]) ?? [],
  );
  const dayNameById = new Map((days ?? []).map((day) => [day.id, day.name]));

  const cardDays: TodayDay[] = (days ?? []).map((day) => {
    const dayItems = (items ?? []).filter(
      (item) => item.plan_day_id === day.id,
    );

    return {
      id: day.id,
      name: day.name,
      focus: day.focus,
      minutes: estimateMinutes(
        dayItems.map((item) => {
          const exercise = exerciseBySlug.get(item.exercise);
          return {
            sets: item.sets,
            repLow: item.rep_low,
            repHigh: item.rep_high,
            restSec: item.rest_sec,
            isTimed: exercise?.is_timed,
            family: exercise?.family,
          };
        }),
      ),
      items: dayItems.map((item) => ({
        name: exerciseBySlug.get(item.exercise)?.name ?? item.exercise,
        sets: item.sets,
        repLow: item.rep_low,
        repHigh: item.rep_high,
      })),
    };
  });

  // The day that matches today's weekday, falling back to the rotation on a
  // day the block does not schedule.
  const suggestedIndex = cardDays.length
    ? suggestedDayIndex({
        today,
        daysPerWeek: cardDays.length,
        completedSessions: completedCount ?? 0,
      })
    : 0;

  /* ------------------------------------------------------------ the week */

  const trainedOn = (history ?? []).map((session) => session.performed_on);
  const target = settings?.days_per_week ?? 0;
  const week = weekDays(trainedOn, today);
  const streak = weekStreak(trainedOn, today, target);

  const startOfWeek = weekStart(today);
  const weekSets = (recentSets ?? []).filter(
    (set) => set.logged_at.slice(0, 10) >= startOfWeek,
  );

  const weekVolume = volumeOf(
    weekSets.map((set) => ({
      weightKg: set.weight_kg === null ? null : Number(set.weight_kg),
      reps: set.reps,
    })),
  );

  /* -------------------------------------------------------- the last months */

  const setsPerDay = new Map<string, number>();
  for (const set of recentSets ?? []) {
    const day = set.logged_at.slice(0, 10);
    setsPerDay.set(day, (setsPerDay.get(day) ?? 0) + 1);
  }

  // Thirteen weeks fits the width of a phone without the squares turning to
  // dust; the full year stays on the Progresso screen.
  const heatColumns = buildHeatmap(
    [...setsPerDay].map(([date, value]) => ({ date, value })),
    new Date(),
    13,
  );

  /* --------------------------------------------------------- the muscles */

  const muscleBySlug = new Map(
    (allExercises ?? []).map((exercise) => [
      exercise.slug,
      exercise.primary_muscle,
    ]),
  );

  const balance = muscleBalance(
    countSetsByMuscle(
      weekSets.map((set) => ({
        exercise: set.exercise,
        completed: true,
        isWarmup: false,
        on: set.logged_at.slice(0, 10),
      })),
      muscleBySlug,
    ),
  );

  const workedMuscles = balance
    .filter((entry) => entry.sets > 0)
    .sort((a, b) => b.sets - a.sets)
    .map((entry) => ({ muscle: entry.muscle, sets: entry.sets }));

  /* --------------------------------------------------- the last session */

  const previous = history?.[0] ?? null;

  const [{ data: previousSets }, { data: previousRecords }] = previous
    ? await Promise.all([
        supabase
          .from("set_logs")
          .select("weight_kg, reps")
          .eq("session_id", previous.id)
          .eq("user_id", user.id)
          .eq("completed", true)
          .eq("is_warmup", false),
        supabase
          .from("personal_records")
          .select("id")
          .eq("user_id", user.id)
          .eq("achieved_on", previous.performed_on),
      ])
    : [{ data: null }, { data: null }];

  const lastSession: LastSession | null = previous
    ? {
        id: previous.id,
        name: previous.plan_day_id
          ? (dayNameById.get(previous.plan_day_id) ?? "Treino")
          : "Treino livre",
        when: relativeDay(previous.performed_on, today),
        minutes: minutesBetween(previous.started_at, previous.ended_at),
        volumeKg: volumeOf(
          (previousSets ?? []).map((set) => ({
            weightKg: set.weight_kg === null ? null : Number(set.weight_kg),
            reps: set.reps,
          })),
        ),
        sets: previousSets?.length ?? 0,
        records: previousRecords?.length ?? 0,
      }
    : null;

  /* --------------------------------------------------------- the partner */

  // Only the partner's last seven days are readable, which is exactly the
  // window worth showing here.
  const partner = members?.[0] ?? null;
  const { data: partnerSessions } = partner
    ? await supabase
        .from("sessions")
        .select("performed_on")
        .eq("user_id", partner.id)
        .eq("status", "completed")
        .order("performed_on", { ascending: false })
    : { data: null };

  const partnerDates = [
    ...new Set((partnerSessions ?? []).map((session) => session.performed_on)),
  ];

  /* ---------------------------------------------------------- the weight */

  // Oldest first, so the sparkline reads left to right.
  const weights = (bodyLogs ?? [])
    .map((log) => ({
      on: log.measured_on,
      kg: Number(log.weight_kg),
    }))
    .reverse();

  const latest = weights[weights.length - 1] ?? null;
  const earliest = weights[0] ?? null;
  const spanWeeks =
    latest && earliest
      ? Math.max(
          1,
          Math.round(
            (Date.parse(latest.on) - Date.parse(earliest.on)) /
              (7 * 86_400_000),
          ),
        )
      : 1;

  return (
    <div className="space-y-5">
      <header>
        <p className="label">{todayLabel()}</p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-4xl leading-tight">
          {profile?.name ? `Olá, ${profile.name.split(" ")[0]}` : "Olá"}
        </h1>
      </header>

      {cardDays.length === 0 ? (
        <Card className="p-5">
          <p className="label">Ainda não tens plano</p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Escolhe quantas vezes treinas por semana e o que tens à mão, e cria o teu primeiro plano.
          </p>
          <Link
            href="/plan"
            className="mt-4 inline-block text-sm text-brass underline underline-offset-4"
          >
            Criar um plano
          </Link>
        </Card>
      ) : openSession ? (
        <Card className="p-5">
          <p className="label">Treino a decorrer</p>
          <p className="mt-2 text-sm text-muted">
            Começaste um treino hoje e não o acabaste.
          </p>
          <Link
            href={`/session/${openSession.id}`}
            className="mt-4 block rounded-[var(--radius-md)] border border-brass bg-brass py-4 text-center font-medium text-ink"
          >
            Retomar o treino
          </Link>
        </Card>
      ) : (
        <TodayCard days={cardDays} suggestedIndex={suggestedIndex} />
      )}

      {target > 0 ? (
        <WeekCard
          days={week}
          trained={trainedThisWeek(trainedOn, today)}
          target={target}
          streak={streak}
        />
      ) : null}

      <StatRow
        stats={[
          { label: "séries", value: String(weekSets.length) },
          {
            label: "kg movidos",
            value: weekVolume > 0 ? formatVolume(weekVolume) : "—",
          },
          { label: "recordes", value: String(weekRecords?.length ?? 0) },
        ]}
      />

      <ActivityCard
        columns={heatColumns}
        daysTrained={setsPerDay.size}
      />

      <MusclesCard worked={workedMuscles} missing={untrained(balance)} />

      {lastSession ? (
        <LastSessionCard session={lastSession} />
      ) : (
        <EmptyCard label="Último treino">
          Ainda não acabaste nenhum treino. Assim que acabares o primeiro, fica
          aqui o resumo: quanto tempo levou, quantas séries fizeste e quanto
          peso moveste.
        </EmptyCard>
      )}

      {partner ? (
        <PartnerCard
          name={partner.name?.split(" ")[0] ?? "O parceiro"}
          trainedToday={partnerDates.includes(today)}
          thisWeek={partnerDates.length}
          lastWhen={
            partnerDates[0] ? relativeDay(partnerDates[0], today) : null
          }
        />
      ) : (
        <EmptyCard
          label="Parceiro"
          href="/settings"
          action="Convidar o parceiro"
        >
          Isto foi feito para dois. Convida a outra pessoa e passas a ver se ela
          já treinou hoje e com que peso ficou em cada exercício.
        </EmptyCard>
      )}

      {latest ? (
        <WeightCard
          values={weights.map((entry) => entry.kg)}
          latest={latest.kg}
          changeKg={earliest ? latest.kg - earliest.kg : null}
          weeks={spanWeeks}
        />
      ) : (
        <EmptyCard label="Peso" href="/progress" action="Registar o peso">
          Ainda não tens nenhum peso registado. Pesa-te uma vez por semana e
          aparece aqui a linha a dizer para onde é que isto vai.
        </EmptyCard>
      )}

      {cardDays.length > 0 ? (
        <p className="text-center text-xs text-faint">
          {completedCount ?? 0} treinos concluídos
        </p>
      ) : null}
    </div>
  );
}
