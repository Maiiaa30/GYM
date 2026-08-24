import { redirect } from "next/navigation";
import { Card, Panel, cx } from "@/components/ui";
import { BodyMap } from "@/components/body-map";
import {
  BarChart,
  Heatmap,
  HeatmapLegend,
  LineChart,
  VolumeBars,
} from "@/components/charts";
import { formatVolume } from "@/lib/home";
import { buildHeatmap } from "@/lib/charts";
import { daysFromToday } from "@/lib/clock";
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
  return daysFromToday(-days);
}

const MONTHS = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

/** "24 ago" — short enough to sit under a chart. */
function shortDate(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${Number(day)} ${MONTHS[Number(month) - 1]}`;
}

export default async function ProgressPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

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
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("body_logs")
      .select("measured_on, weight_kg")
      .eq("user_id", user.id)
      .order("measured_on", { ascending: true })
      .limit(400),
    supabase
      .from("set_logs")
      .select("exercise, completed, is_warmup, weight_kg, reps, logged_at")
      .eq("user_id", user.id)
      .gte("logged_at", `${yearAgo}T00:00:00Z`)
      .limit(6000),
    supabase.from("exercises").select("slug, name, primary_muscle"),
    supabase
      .from("personal_records")
      .select("exercise, weight_kg, reps, estimated_1rm, achieved_on")
      .eq("user_id", user.id)
      .order("estimated_1rm", { ascending: false }),
    supabase
      .from("progression")
      .select("exercise, working_kg, updated_at")
      .eq("user_id", user.id)
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
      <Panel
        title="Peso"
        meta={
          change !== null ? (
            <span
              className={cx(
                towardsGoal === null
                  ? "text-muted"
                  : towardsGoal
                    ? "text-brass"
                    : "text-oxblood",
              )}
            >
              {change >= 0 ? "+" : ""}
              {change.toFixed(1)} kg
            </span>
          ) : null
        }
        note={
          goal !== null
            ? `Objetivo ${goal} kg. A linha tracejada é onde queres chegar.`
            : "Define um objetivo em baixo para teres uma linha por onde te guiares."
        }
      >
        <p className="tabular font-[family-name:var(--font-display)] text-5xl leading-none">
          {latest ? latest.kg.toFixed(1) : "—"}
          <span className="ml-1 text-lg text-muted">kg</span>
        </p>

        <div className="-mx-2 mt-4">
          <LineChart
            values={weights.map((entry) => entry.kg)}
            goal={goal}
            label="Peso corporal ao longo do tempo"
            startLabel={weights.length > 1 ? shortDate(weights[0].on) : undefined}
            endLabel={latest ? shortDate(latest.on) : undefined}
          />
        </div>
      </Panel>

      <Panel title="Registar">
        <div className="space-y-4">
          <WeightForm current={latest?.kg ?? null} />
          <GoalForm current={goal} />
        </div>
      </Panel>

      {weights.length > 0 ? (
        <Card className="px-5 py-1">
          <details className="disclosure">
            <summary className="label">
              Registos anteriores
            </summary>
            <ul className="divide-y divide-line border-t border-line pb-2">
              {[...weights]
                .reverse()
                .slice(0, 12)
                .map((entry) => (
                  <li
                    key={entry.on}
                    className="flex items-center justify-between py-2.5"
                  >
                    <span className="text-sm text-muted">
                      {shortDate(entry.on)}
                    </span>
                    <span className="tabular text-sm">
                      {entry.kg.toFixed(1)} kg
                    </span>
                  </li>
                ))}
            </ul>
          </details>
        </Card>
      ) : null}
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

  const volumeDays = [...perDay.keys()].sort().slice(-12);
  const volumeByDay = volumeDays.map((day) =>
    Math.round(
      workingSets
        .filter((set) => set.logged_at.slice(0, 10) === day)
        .reduce(
          (total, set) => total + Number(set.weight_kg ?? 0) * (set.reps ?? 0),
          0,
        ),
    ),
  );

  const activitySection = (
    <div className="space-y-5">
      <Panel
        title="Atividade"
        meta={`${daysTrained30} em 30 dias`}
        note="Um quadrado por dia do último ano, mais escuro quantas mais séries fizeste."
      >
        <div className="-mx-5 px-5">
          <Heatmap columns={columns} />
        </div>
        <div className="mt-3">
          <HeatmapLegend />
        </div>
      </Panel>

      <Panel
        title="Volume por treino"
        meta={volumeByDay.length > 0 ? `últimos ${volumeByDay.length}` : null}
        note="Peso × repetições, somado em cada treino. Séries de aquecimento não contam."
      >
        {volumeByDay.length > 1 ? (
          <div className="-mx-2">
            <BarChart
              values={volumeByDay}
              format={(value) => `${formatVolume(value)} kg`}
              label="Volume por treino, em quilos levantados"
              startLabel={shortDate(volumeDays[0])}
              endLabel={shortDate(volumeDays[volumeDays.length - 1])}
            />
          </div>
        ) : (
          <p className="text-sm text-muted">
            Faz mais um treino para haver alguma coisa para comparar.
          </p>
        )}
      </Panel>
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


  const worked = week.filter((entry) => entry.sets > 0).length;

  const musclesSection = (
    <div className="space-y-5">
      <Panel
        title="Últimos 7 dias"
        meta={`${worked} de ${week.length} grupos`}
        note={
          missed.length > 0
            ? `Sem trabalho esta semana: ${missed.join(", ")}.`
            : "Todos os grupos apanharam trabalho esta semana."
        }
      >
        <div className="-mx-5">
          <BodyMap rows={week} />
        </div>
      </Panel>

      <Panel
        title="Séries por grupo"
        note="Séries de trabalho dos últimos sete dias, sem contar aquecimentos."
      >
        <VolumeBars rows={week} />
      </Panel>
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
    <div className="space-y-5">
      <Panel
        title="Cargas de trabalho"
        meta={lifts.length > 0 ? `${lifts.length} exercícios` : null}
        note={
          lifts.length > 0
            ? "O peso com que estás a trabalhar agora. O 1RM é uma estimativa a partir da tua melhor série, não uma coisa para ires tentar."
            : undefined
        }
      >
        {lifts.length > 0 ? (
          <ul className="-mt-1 divide-y divide-line">
            {lifts.map((lift) => (
              <li key={lift.slug} className="py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm">{lift.name}</span>
                  <span className="tabular shrink-0 font-[family-name:var(--font-display)] text-xl text-brass">
                    {lift.working}
                    <span className="ml-0.5 text-xs text-muted">kg</span>
                  </span>
                </div>
                {lift.best ? (
                  <p className="tabular mt-1 text-xs text-faint">
                    Melhor série {lift.best.kg} kg × {lift.best.reps} · 1RM ~
                    {lift.best.oneRm} kg
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">
            Ainda não há cargas registadas. Aparecem depois do primeiro treino.
          </p>
        )}
      </Panel>
    </div>
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
