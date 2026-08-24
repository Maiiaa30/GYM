import Link from "next/link";
import { Card, cx } from "@/components/ui";
import { buildSeries, type ChartBox, type HeatCell } from "@/lib/charts";
import { formatVolume, type DaySlot } from "@/lib/home";

/* ------------------------------------------------------------ small parts */

/**
 * A card that is worth showing before there is any history behind it: the
 * empty state is the invitation, so the opening screen never collapses to a
 * greeting and one button.
 */
export function EmptyCard({
  label,
  children,
  href,
  action,
}: {
  label: string;
  children: React.ReactNode;
  href?: string;
  action?: string;
}) {
  return (
    <Card className="p-5">
      <p className="label">{label}</p>
      <p className="mt-2 text-sm leading-relaxed text-muted">{children}</p>
      {href && action ? (
        <Link
          href={href}
          className="mt-3 inline-block text-sm text-brass underline underline-offset-4"
        >
          {action}
        </Link>
      ) : null}
    </Card>
  );
}

/** Three numbers that say how the week is going, side by side. */
export function StatRow({
  stats,
}: {
  stats: Array<{ label: string; value: string; hint?: string }>;
}) {
  return (
    <Card className="grid grid-cols-3 divide-x divide-line">
      {stats.map((stat) => (
        <div key={stat.label} className="px-3 py-4 text-center">
          <p className="tabular font-[family-name:var(--font-display)] text-2xl leading-none">
            {stat.value}
          </p>
          <p className="mt-1.5 text-[0.625rem] uppercase tracking-[0.12em] text-faint">
            {stat.label}
          </p>
        </div>
      ))}
    </Card>
  );
}

/* -------------------------------------------------------------- heatmap */

const HEAT_CLASS = [
  "bg-raised",
  "bg-brass/25",
  "bg-brass/45",
  "bg-brass/70",
  "bg-brass",
];

/**
 * The last few months of training as a grid. The full year lives in Progresso;
 * this is the short version, and it is the thing on the screen that shows the
 * habit actually accumulating.
 */
export function ActivityCard({
  columns,
  daysTrained,
}: {
  columns: HeatCell[][];
  daysTrained: number;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="label">Atividade</p>
        <Link
          href="/progress"
          className="text-xs uppercase tracking-[0.14em] text-faint"
        >
          Ver o ano
        </Link>
      </div>

      <div className="mt-4 flex gap-[3px]" aria-hidden="true">
        {columns.map((week) => (
          <div key={week[0].date} className="flex flex-1 flex-col gap-[3px]">
            {week.map((cell) => (
              <span
                key={cell.date}
                className={cx(
                  "aspect-square w-full rounded-[1px]",
                  HEAT_CLASS[cell.level],
                )}
              />
            ))}
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs text-faint">
        {daysTrained === 0
          ? "Ainda sem treinos registados."
          : daysTrained === 1
            ? "1 dia treinado nos últimos três meses."
            : `${daysTrained} dias treinados nos últimos três meses.`}
      </p>
    </Card>
  );
}

/* -------------------------------------------------------------- muscles */

/**
 * Which groups the week actually hit. Naming the ones that got nothing is the
 * useful half: it is what tells them the next day to pick.
 */
export function MusclesCard({
  worked,
  missing,
}: {
  worked: Array<{ muscle: string; sets: number }>;
  missing: string[];
}) {
  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="label">Músculos esta semana</p>
        <Link
          href="/progress"
          className="text-xs uppercase tracking-[0.14em] text-faint"
        >
          Ver o mapa
        </Link>
      </div>

      {worked.length === 0 ? (
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Ainda não treinaste esta semana. Assim que fizeres a primeira série,
          aparece aqui onde é que o trabalho foi parar.
        </p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {worked.map((entry) => (
            <li
              key={entry.muscle}
              className="tabular rounded-full border border-line-strong px-2.5 py-1 text-xs text-parchment"
            >
              {entry.muscle} <span className="text-faint">{entry.sets}</span>
            </li>
          ))}
        </ul>
      )}

      {missing.length > 0 && worked.length > 0 ? (
        <p className="mt-3 text-xs leading-relaxed text-faint">
          Ainda por trabalhar: {missing.join(", ")}.
        </p>
      ) : null}
    </Card>
  );
}

/* ------------------------------------------------------------- the week */

/**
 * Seven dots is the whole week at a glance, which is what someone wants on
 * opening the application: what has been done, what is left, and whether the
 * habit is holding.
 */
export function WeekCard({
  days,
  trained,
  target,
  streak,
}: {
  days: DaySlot[];
  trained: number;
  target: number;
  streak: number;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="label">Esta semana</p>
        <p className="tabular text-xs text-faint">
          {trained} de {target}
        </p>
      </div>

      <ul className="mt-4 flex justify-between gap-1">
        {days.map((day) => (
          <li key={day.date} className="flex flex-1 flex-col items-center gap-2">
            <span
              className={cx(
                "text-[0.625rem] uppercase tracking-[0.12em]",
                day.isToday ? "text-brass" : "text-faint",
              )}
            >
              {day.initial}
            </span>
            <span
              aria-hidden="true"
              className={cx(
                "h-2.5 w-2.5 rounded-full border",
                day.trained
                  ? "border-brass bg-brass"
                  : day.isToday
                    ? "border-brass bg-transparent"
                    : day.isFuture
                      ? "border-line bg-transparent"
                      : "border-line-strong bg-raised",
              )}
            />
            <span className="sr-only">
              {day.trained ? "treinado" : "sem treino"}
            </span>
          </li>
        ))}
      </ul>

      {streak > 0 ? (
        <p className="mt-4 text-xs text-faint">
          {streak === 1
            ? "Primeira semana com o objetivo cumprido."
            : `${streak} semanas seguidas com o objetivo cumprido.`}
        </p>
      ) : null}
    </Card>
  );
}

/* ------------------------------------------------------- the last session */

export type LastSession = {
  id: string;
  name: string;
  when: string;
  minutes: number | null;
  volumeKg: number;
  sets: number;
  records: number;
};

export function LastSessionCard({ session }: { session: LastSession }) {
  const facts = [
    session.minutes !== null ? `${session.minutes} min` : null,
    `${session.sets} séries`,
    session.volumeKg > 0 ? `${formatVolume(session.volumeKg)} kg` : null,
  ].filter(Boolean);

  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="label">Último treino</p>
        <p className="text-xs text-faint">{session.when}</p>
      </div>

      <p className="mt-2 font-[family-name:var(--font-display)] text-2xl">
        {session.name}
      </p>

      <p className="tabular mt-1 text-sm text-muted">{facts.join(" · ")}</p>

      {session.records > 0 ? (
        <p className="mt-3 text-xs text-brass">
          {session.records === 1
            ? "1 recorde pessoal"
            : `${session.records} recordes pessoais`}
        </p>
      ) : null}

      <Link
        href={`/session/${session.id}/summary`}
        className="mt-4 inline-block text-xs uppercase tracking-[0.14em] text-faint"
      >
        Ver o resumo
      </Link>
    </Card>
  );
}

/* ------------------------------------------------------------- the partner */

/**
 * They train together, so whether the other one has already been is real
 * information rather than decoration. Only the last seven days are readable,
 * which is all this needs.
 */
export function PartnerCard({
  name,
  trainedToday,
  thisWeek,
  lastWhen,
}: {
  name: string;
  trainedToday: boolean;
  thisWeek: number;
  lastWhen: string | null;
}) {
  return (
    <Card className="p-5">
      <p className="label">Parceiro</p>
      <p className="mt-2 text-sm leading-relaxed">
        {trainedToday ? (
          <>
            <span className="text-parchment">{name}</span> já treinou hoje.
          </>
        ) : lastWhen ? (
          <>
            <span className="text-parchment">{name}</span> treinou {lastWhen}.
          </>
        ) : (
          <>
            <span className="text-parchment">{name}</span> ainda não treinou
            esta semana.
          </>
        )}
      </p>
      {thisWeek > 0 ? (
        <p className="tabular mt-1 text-xs text-faint">
          {thisWeek === 1
            ? "1 treino nos últimos 7 dias"
            : `${thisWeek} treinos nos últimos 7 dias`}
        </p>
      ) : null}
    </Card>
  );
}

/* -------------------------------------------------------------- the weight */

const SPARK: ChartBox = {
  width: 140,
  height: 36,
  padTop: 4,
  padBottom: 4,
  padLeft: 2,
  padRight: 2,
};

/** The weight tab in one line: where it is now and which way it is going. */
export function WeightCard({
  values,
  latest,
  changeKg,
  weeks,
}: {
  values: number[];
  latest: number;
  changeKg: number | null;
  weeks: number;
}) {
  const series = buildSeries(values, SPARK);
  const direction =
    changeKg === null || Math.abs(changeKg) < 0.05
      ? null
      : changeKg > 0
        ? `+${format(changeKg)} kg`
        : `−${format(Math.abs(changeKg))} kg`;

  return (
    <Card className="flex items-center justify-between gap-4 p-5">
      <div>
        <p className="label">Peso</p>
        <p className="tabular mt-1 font-[family-name:var(--font-display)] text-3xl">
          {format(latest)}
          <span className="ml-1 text-base text-muted">kg</span>
        </p>
        {direction ? (
          <p className="tabular mt-1 text-xs text-faint">
            {direction} em {weeks === 1 ? "1 semana" : `${weeks} semanas`}
          </p>
        ) : null}
      </div>

      {series ? (
        <svg
          viewBox={`0 0 ${SPARK.width} ${SPARK.height}`}
          className="h-9 w-36 shrink-0"
          role="img"
          aria-label="Evolução do peso"
        >
          <path
            d={series.path}
            className="fill-none stroke-brass [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.5]"
          />
        </svg>
      ) : null}
    </Card>
  );
}

/** One decimal, comma separated, the way a weight is written in Portuguese. */
function format(kg: number): string {
  return kg.toFixed(1).replace(".", ",").replace(/,0$/, "");
}
