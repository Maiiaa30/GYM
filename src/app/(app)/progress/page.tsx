import { redirect } from "next/navigation";
import { Panel, Section, StatGrid, StatTile, cx } from "@/components/ui";
import { BodyMap } from "@/components/body-map";
import {
  BarChart,
  Sparkline,
  Heatmap,
  HeatmapLegend,
  LineChart,
  VolumeBars,
} from "@/components/charts";
import { formatVolume } from "@/lib/home";
import { buildHeatmap, buildSeries, type ChartBox } from "@/lib/charts";
import { daysFromToday, today as todayInGym } from "@/lib/clock";
import { describeTrend, directionOf, readTrend } from "@/lib/gaining";
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
      .select("weight_goal_kg, height_cm")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("body_logs")
      .select("measured_on, weight_kg, waist_cm")
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
      .select("exercise, working_kg, updated_at, fail_count, last_action")
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

  const waists = (logs ?? [])
    .filter((log) => log.waist_cm !== null)
    .map((log) => ({ on: log.measured_on, cm: Number(log.waist_cm) }));
  const lastWaist = waists[waists.length - 1] ?? null;
  const firstWaist = waists[0] ?? null;

  const goal = profile?.weight_goal_kg === null || profile?.weight_goal_kg === undefined
    ? null
    : Number(profile.weight_goal_kg);

  const latest = weights.length > 0 ? weights[weights.length - 1] : null;
  const first = weights.length > 0 ? weights[0] : null;
  const previous = weights.length > 1 ? weights[weights.length - 2] : null;
  const change = latest && previous ? latest.kg - previous.kg : null;

  // A change is good when it moves towards the goal, whichever side it is on.
  const towardsGoal =
    change !== null && goal !== null && latest
      ? Math.abs(latest.kg - goal) < Math.abs(previous!.kg - goal)
      : null;

  const workingSets = (sets ?? []).filter(
    (set) => set.completed && !set.is_warmup,
  );

  // Sessions inside the same window the trend is read over, so a flat scale
  // can be told apart from a month nobody trained.
  const trendFrom = daysAgo(35);
  const sessionsInWindow = new Set(
    workingSets
      .map((set) => set.logged_at.slice(0, 10))
      .filter((day) => day >= trendFrom),
  ).size;

  /* The three readings the tiles carry. Each is only shown when the history
     behind it exists — a tile that says "—" is worse than no tile. */
  const weekAgo = daysAgo(7);
  const beforeWeek = weights.filter((entry) => entry.on <= weekAgo);
  const weekBase = beforeWeek[beforeWeek.length - 1] ?? null;
  const weekChange = latest && weekBase ? latest.kg - weekBase.kg : null;

  const heightM = profile?.height_cm ? Number(profile.height_cm) / 100 : null;
  const bmi = heightM && latest ? latest.kg / (heightM * heightM) : null;
  const bmiFirst = heightM && first ? first.kg / (heightM * heightM) : null;

  const totalChange = latest && first ? latest.kg - first.kg : null;

  const movingRight = (delta: number | null) =>
    delta !== null &&
    goal !== null &&
    latest !== null &&
    ((goal < latest.kg && delta < 0) || (goal > latest.kg && delta > 0));
  const towardsWeek = movingRight(weekChange);
  const towardsTotal = movingRight(totalChange);

  const direction = directionOf(latest?.kg ?? null, goal);
  const trend = describeTrend(
    readTrend({
      readings: weights,
      sessions: sessionsInWindow,
      direction,
      today: todayInGym(),
    }),
    direction,
  );

  const weightSection = (
    <div>
      <Panel
        title="Peso"
        meta={
          change !== null ? (
            <span
              className={cx(
                towardsGoal === null
                  ? "text-muted"
                  : towardsGoal
                    ? "text-amber"
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
        {/*
          Three numbers and a bar: where this started, where it is, where it is
          going. The current weight is the only one set large — the other two
          are the scale it is read against, not figures anyone needs to check.
          Without the start and the goal beside it a weight is just a number,
          and the one thing it has to say is whether it is moving the right way.
        */}
        {latest && first && goal !== null && first.kg !== goal ? (
          <>
            <div className="flex items-end justify-between gap-2">
              <div>
                <p className="label-sm">Inicial</p>
                <p className="display mt-1 text-[1.625rem] font-semibold text-muted">
                  {first.kg.toFixed(1)}
                </p>
              </div>
              <div className="text-center">
                <p className="label-sm">Atual</p>
                <p className="display mt-1 text-[3.25rem] leading-[0.92] text-parchment">
                  {latest.kg.toFixed(1)}
                </p>
              </div>
              <div className="text-right">
                <p className="label-sm">Meta</p>
                <p className="display mt-1 text-[1.625rem] font-semibold text-muted">
                  {goal.toFixed(1)}
                </p>
              </div>
            </div>

            <div className="mt-4 h-[3px] w-full bg-line-strong">
              <div
                className="h-full bg-amber"
                style={{ width: `${goalProgress(first.kg, latest.kg, goal)}%` }}
              />
            </div>
            <p className="mt-3 text-[0.78125rem] text-muted">
              {goalProgress(first.kg, latest.kg, goal)}% do caminho · faltam{" "}
              {Math.abs(latest.kg - goal).toFixed(1)} kg
            </p>
          </>
        ) : (
          <p className="display text-[3.25rem] leading-none text-parchment">
            {latest ? latest.kg.toFixed(1) : "—"}
            <span className="ml-1 text-lg font-semibold normal-case text-faint">kg</span>
          </p>
        )}

        {trend ? (
          <p
            className={cx(
              "mt-4 border-l-[3px] pl-3 text-sm leading-relaxed",
              trend.tone === "warn"
                ? "border-oxblood text-parchment"
                : trend.tone === "good"
                  ? "border-amber text-muted"
                  : "border-line-strong text-muted",
            )}
          >
            {trend.text}
          </p>
        ) : null}

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

      {lastWaist ? (
        <Panel
          title="Cintura"
          meta={
            firstWaist && firstWaist.on !== lastWaist.on
              ? `${(lastWaist.cm - firstWaist.cm) >= 0 ? "+" : "−"}${Math.abs(lastWaist.cm - firstWaist.cm).toFixed(1).replace(".", ",")} cm`
              : null
          }
          note="Peso a subir e cintura parada é o sinal de que estás a ganhar músculo e não só peso."
        >
          <p className="display text-[2.5rem] leading-none text-parchment">
            {lastWaist.cm.toFixed(1).replace(".", ",").replace(/,0$/, "")}
            <span className="ml-1 text-base font-semibold normal-case text-faint">cm</span>
          </p>
        </Panel>
      ) : null}

      <Panel title="Registar">
        <div className="space-y-4">
          <WeightForm
            current={latest?.kg ?? null}
            waist={lastWaist?.cm ?? null}
          />
          <GoalForm current={goal} />
        </div>
      </Panel>

      {/* Three readings of the same history, side by side: the week just gone,
          what the weight means for this body, and the whole distance covered.
          The line under each is what says which way it is going — a number on
          its own says where you are and nothing about where you are headed. */}
      {latest ? (
        <div className="border-b border-line">
          <StatGrid tight>
            <StatTile
              label="7 dias"
              value={
                weekChange === null
                  ? "—"
                  : `${weekChange > 0 ? "+" : weekChange < 0 ? "−" : ""}${Math.abs(weekChange).toFixed(1)}`
              }
              note={
                weekChange === null
                  ? "sem leitura"
                  : Math.abs(weekChange) < 0.3
                    ? "estável"
                    : weekChange < 0
                      ? "a descer"
                      : "a subir"
              }
              tone={towardsWeek ? "amber" : "neutral"}
              spark={<Spark values={weights.slice(-8).map((w) => w.kg)} />}
            />
            <StatTile
              label="IMC"
              value={bmi === null ? "—" : bmi.toFixed(1)}
              note={
                bmi !== null && bmiFirst !== null
                  ? // Just the delta: a third of a 320px screen does not hold
                    // a sentence, and the tile beside it already says "desde".
                    `${bmi - bmiFirst >= 0 ? "+" : "−"}${Math.abs(bmi - bmiFirst).toFixed(1)}`
                  : "falta a altura"
              }
              spark={
                heightM ? (
                  <Spark
                    values={weights
                      .slice(-8)
                      .map((w) => w.kg / (heightM * heightM))}
                  />
                ) : null
              }
            />
            <StatTile
              label={totalChange !== null && totalChange > 0 ? "Ganhos" : "Perdidos"}
              value={totalChange === null ? "—" : Math.abs(totalChange).toFixed(1)}
              unit="kg"
              note={first ? `desde ${shortDate(first.on)}` : undefined}
              tone={towardsTotal ? "amber" : "neutral"}
              spark={<Spark values={weights.map((w) => w.kg)} />}
            />
          </StatGrid>
        </div>
      ) : null}

      {weights.length > 0 ? (
        <Section>
          <details className="disclosure">
            <summary className="action">Registos anteriores</summary>
            <ul className="pb-2">
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
        </Section>
      ) : null}
    </div>
  );

  /* ----------------------------------------------------------- activity */

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
    <div>
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
    <div>
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
      action: row.last_action,
      failCount: row.fail_count,
    }));

  // The engine has recorded a missed session and a deload since the beginning
  // and nothing ever said so out loud. A lift that held or came down is not a
  // failure, but it is the one thing worth reading on this screen.
  /**
   * The heaviest working set of each session, per exercise, oldest first.
   * The records were always stored; nothing ever drew the line between them.
   */
  const historyBySlug = new Map<string, number[]>();
  for (const slug of lifts.map((lift) => lift.slug)) {
    const perDay = new Map<string, number>();
    for (const set of workingSets) {
      if (set.exercise !== slug) continue;
      const day = set.logged_at.slice(0, 10);
      const kg = Number(set.weight_kg ?? 0);
      if (kg <= 0) continue;
      perDay.set(day, Math.max(perDay.get(day) ?? 0, kg));
    }
    const series = [...perDay.entries()].sort().map(([, kg]) => kg);
    if (series.length >= 3) historyBySlug.set(slug, series.slice(-16));
  }

  const stalled = lifts.filter(
    (lift) => lift.action === "hold" || lift.action === "deload",
  );

  const strengthSection = (
    <div>
      {stalled.length > 0 ? (
        <Panel
          title="Parados"
          meta={`${stalled.length} de ${lifts.length}`}
          note="Um peso que não sobe quase nunca é o treino: é dormir pouco, comer pouco, ou ter subido depressa demais. Fecha as repetições todas antes de voltares a acrescentar peso."
        >
          <ul className="-mt-1 divide-y divide-line">
            {stalled.map((lift) => (
              <li key={lift.slug} className="py-2.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm">{lift.name}</span>
                  <span className="tabular shrink-0 text-sm text-oxblood">
                    {lift.action === "deload" ? "desceu" : "sem subir"}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-faint">
                  {lift.action === "deload"
                    ? `Desceu para ${lift.working} kg depois de duas vezes sem fechar as repetições.`
                    : `Está nos ${lift.working} kg à espera de uma sessão com tudo feito.`}
                </p>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

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
                  <span className="display shrink-0 text-xl text-amber">
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
                {historyBySlug.has(lift.slug) ? (
                  <div className="-mx-1 mt-2">
                    <Sparkline values={historyBySlug.get(lift.slug)!} />
                  </div>
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
    <div>
      <header className="gutter pb-4">
        <p className="label">Histórico</p>
        <h1 className="display mt-2 text-[2rem] text-parchment">
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

/**
 * How far along the way to the goal the current weight is, as a whole
 * percentage, clamped. Measured from the first reading rather than from zero:
 * the distance that matters is the one they have actually set out to cover.
 */
function goalProgress(first: number, current: number, goal: number): number {
  const span = goal - first;
  if (span === 0) return 100;
  return Math.max(0, Math.min(100, Math.round(((current - first) / span) * 100)));
}

const SPARK_BOX: ChartBox = {
  width: 100,
  height: 18,
  padTop: 3,
  padBottom: 3,
  padLeft: 1,
  padRight: 1,
};

/**
 * The shape of a series in the width of a tile. No axes, no labels and no
 * scale — it is not there to be read off, only to say which way the number
 * above it has been moving. Two readings are the fewest that have a direction.
 */
function Spark({ values }: { values: number[] }) {
  const series = buildSeries(values, SPARK_BOX);
  if (!series) return null;
  return (
    <svg
      viewBox={`0 0 ${SPARK_BOX.width} ${SPARK_BOX.height}`}
      className="h-4 w-full"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d={series.path}
        className="fill-none stroke-amber [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.4]"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
