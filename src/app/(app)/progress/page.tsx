import { Card } from "@/components/ui";
import { BodyMap } from "@/components/body-map";
import { Heatmap, HeatmapLegend, LineChart, VolumeBars } from "@/components/charts";
import { buildHeatmap, toISODate } from "@/lib/charts";
import {
  countSetsByMuscle,
  muscleBalance,
  untrained,
  withinDays,
} from "@/lib/muscle-volume";
import { createClient } from "@/lib/supabase/server";
import { GoalForm } from "./goal-form";
import { ProgressTabs } from "./tabs";
import { WeightForm } from "./weight-form";

export const dynamic = "force-dynamic";

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return toISODate(date);
}

export default async function ProgressPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const yearAgo = daysAgo(370);

  const [
    { data: profile },
    { data: logs },
    { data: sets },
    { data: exercises },
    { data: records },
    { data: progression },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("weight_goal_kg")
      .eq("id", user!.id)
      .maybeSingle(),
    supabase
      .from("body_logs")
      .select("measured_on, weight_kg")
      .eq("user_id", user!.id)
      .order("measured_on", { ascending: true })
      .limit(400),
    supabase
      .from("set_logs")
      .select("exercise, completed, is_warmup, weight_kg, reps, logged_at")
      .eq("user_id", user!.id)
      .gte("logged_at", `${yearAgo}T00:00:00Z`)
      .limit(6000),
    supabase.from("exercises").select("slug, name, primary_muscle"),
    supabase
      .from("personal_records")
      .select("exercise, weight_kg, reps, estimated_1rm, achieved_on")
      .eq("user_id", user!.id)
      .order("estimated_1rm", { ascending: false }),
    supabase
      .from("progression")
      .select("exercise, working_kg, updated_at")
      .eq("user_id", user!.id)
      .order("updated_at", { ascending: false }),
  ]);

  /* ------------------------------------------------------------- weight */

  const weights = (logs ?? [])
    .filter((log) => log.weight_kg !== null)
    .map((log) => ({
      on: log.measured_on,
      kg: Number(log.weight_kg),
    }));

  const goal = profile?.weight_goal_kg === null || profile?.weight_goal_kg === undefined
    ? null
    : Number(profile.weight_goal_kg);

  const latest = weights.length > 0 ? weights[weights.length - 1] : null;
  const previous = weights.length > 1 ? weights[weights.length - 2] : null;
  const change = latest && previous ? latest.kg - previous.kg : null;

  // A change is good when it moves towards the goal, whichever side it is on.
  const towardsGoal =
    change !== null && goal !== null && latest
      ? Math.abs(latest.kg - goal) < Math.abs(previous!.kg - goal)
      : null;

  const weightSection = (
    <div className="space-y-5">
      <Card>
        <div className="flex items-baseline justify-between px-5 pt-5">
          <div>
            <p className="label">Último registo</p>
            <p className="tabular mt-1 font-[family-name:var(--font-display)] text-5xl">
              {latest ? latest.kg.toFixed(1) : "—"}
              <span className="ml-1 text-lg text-muted">kg</span>
            </p>
          </div>
          {change !== null ? (
            <p
              className={
                towardsGoal === null
                  ? "tabular text-sm text-muted"
                  : towardsGoal
                    ? "tabular text-sm text-brass"
                    : "tabular text-sm text-oxblood"
              }
            >
              {change >= 0 ? "+" : ""}
              {change.toFixed(1)} kg
            </p>
          ) : null}
        </div>
        <div className="mt-4">
          <LineChart
            values={weights.map((entry) => entry.kg)}
            goal={goal}
            label="Peso corporal ao longo do tempo"
          />
        </div>
        <div className="rule space-y-4 px-5 py-4">
          <WeightForm current={latest?.kg ?? null} />
          <GoalForm current={goal} />
        </div>
      </Card>

      <Card>
        <p className="label px-5 pt-4">Registos recentes</p>
        {weights.length > 0 ? (
          <ul className="mt-2 divide-y divide-line">
            {[...weights]
              .reverse()
              .slice(0, 10)
              .map((entry) => (
                <li
                  key={entry.on}
                  className="flex items-center justify-between px-5 py-3"
                >
                  <span className="text-sm text-muted">{entry.on}</span>
                  <span className="tabular text-sm">{entry.kg.toFixed(1)} kg</span>
                </li>
              ))}
          </ul>
        ) : (
          <p className="px-5 py-4 text-sm text-muted">Ainda não há registos.</p>
        )}
      </Card>
    </div>
  );

  /* ----------------------------------------------------------- activity */

  const workingSets = (sets ?? []).filter(
    (set) => set.completed && !set.is_warmup,
  );

  const perDay = new Map<string, number>();
  for (const set of workingSets) {
    const day = set.logged_at.slice(0, 10);
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }

  const columns = buildHeatmap(
    [...perDay].map(([date, value]) => ({ date, value })),
    new Date(),
  );

  const last30 = daysAgo(30);
  const daysTrained30 = [...perDay.keys()].filter((day) => day >= last30).length;

  const volumeByDay = [...perDay.keys()]
    .sort()
    .slice(-12)
    .map((day) =>
      workingSets
        .filter((set) => set.logged_at.slice(0, 10) === day)
        .reduce(
          (total, set) => total + Number(set.weight_kg ?? 0) * (set.reps ?? 0),
          0,
        ),
    );

  const activitySection = (
    <div className="space-y-5">
      <Card>
        <div className="flex items-baseline justify-between px-5 pt-5">
          <div>
            <p className="label">Últimos 30 dias</p>
            <p className="tabular mt-1 font-[family-name:var(--font-display)] text-5xl">
              {daysTrained30}
              <span className="ml-1 text-lg text-muted">
                {daysTrained30 === 1 ? "treino" : "treinos"}
              </span>
            </p>
          </div>
        </div>
        <div className="mt-4">
          <Heatmap columns={columns} />
          <HeatmapLegend />
        </div>
        <p className="px-5 pb-4 pt-3 text-xs leading-relaxed text-faint">
          Um quadrado por dia do último ano, mais escuro quantas mais séries
          fizeste.
        </p>
      </Card>

      <Card>
        <p className="label px-5 pt-4">Volume por treino</p>
        {volumeByDay.length > 1 ? (
          <>
            <div className="mt-2">
              <LineChart
                values={volumeByDay}
                label="Volume por treino, em quilos levantados"
              />
            </div>
            <p className="px-5 pb-4 text-xs text-faint">
              Últimos {volumeByDay.length} treinos, em quilos levantados
              (séries × repetições × peso).
            </p>
          </>
        ) : (
          <p className="px-5 py-4 text-sm text-muted">
            Faz mais um treino para haver linha que desenhar.
          </p>
        )}
      </Card>
    </div>
  );

  /* ------------------------------------------------------------ muscles */

  const muscleBySlug = new Map(
    (exercises ?? []).map((exercise) => [exercise.slug, exercise.primary_muscle]),
  );
  const nameBySlug = new Map(
    (exercises ?? []).map((exercise) => [exercise.slug, exercise.name]),
  );

  const asLogged = workingSets.map((set) => ({
    exercise: set.exercise,
    completed: true,
    isWarmup: false,
    on: set.logged_at.slice(0, 10),
  }));

  const week = muscleBalance(
    countSetsByMuscle(withinDays(asLogged, daysAgo(7)), muscleBySlug),
  );
  const missed = untrained(week);
  const shares = new Map(week.map((entry) => [entry.muscle, entry.share]));

  const musclesSection = (
    <div className="space-y-5">
      <Card>
        <p className="label px-5 pt-4">Sete dias</p>
        <BodyMap shares={shares} />
        {missed.length > 0 ? (
          <p className="px-5 pb-4 text-xs leading-relaxed text-faint">
            Sem trabalho esta semana: {missed.join(", ")}.
          </p>
        ) : (
          <p className="px-5 pb-4 text-xs text-faint">
            Todos os grupos apanharam trabalho esta semana.
          </p>
        )}
      </Card>

      <Card>
        <p className="label px-5 pt-4">Séries por grupo</p>
        <VolumeBars rows={week} />
      </Card>
    </div>
  );

  /* ----------------------------------------------------------- strength */

  const bestBySlug = new Map<string, { kg: number; reps: number; oneRm: number }>();
  for (const record of records ?? []) {
    if (bestBySlug.has(record.exercise)) continue;
    bestBySlug.set(record.exercise, {
      kg: Number(record.weight_kg),
      reps: record.reps,
      oneRm: Number(record.estimated_1rm),
    });
  }

  const lifts = (progression ?? [])
    .filter((row) => Number(row.working_kg) > 0)
    .map((row) => ({
      slug: row.exercise,
      name: nameBySlug.get(row.exercise) ?? row.exercise,
      working: Number(row.working_kg),
      best: bestBySlug.get(row.exercise) ?? null,
    }));

  const strengthSection = (
    <Card>
      <p className="label px-5 pt-4">Cargas de trabalho</p>
      {lifts.length > 0 ? (
        <ul className="mt-2 divide-y divide-line">
          {lifts.map((lift) => (
            <li key={lift.slug} className="px-5 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm">{lift.name}</span>
                <span className="tabular text-sm text-brass">
                  {lift.working} kg
                </span>
              </div>
              {lift.best ? (
                <p className="tabular mt-1 text-xs text-faint">
                  Melhor série: {lift.best.kg} kg × {lift.best.reps} · 1RM
                  estimado {lift.best.oneRm} kg
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-5 py-4 text-sm text-muted">
          Ainda não há cargas registadas. Aparecem depois do primeiro treino.
        </p>
      )}
    </Card>
  );

  return (
    <div className="space-y-6">
      <header>
        <p className="label">Histórico</p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-4xl">
          Progresso
        </h1>
      </header>

      <ProgressTabs
        weight={weightSection}
        activity={activitySection}
        muscles={musclesSection}
        strength={strengthSection}
      />
    </div>
  );
}
