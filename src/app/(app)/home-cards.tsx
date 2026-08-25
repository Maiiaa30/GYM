import Link from "next/link";
import { Panel, Section, Stat, StatGrid, cx } from "@/components/ui";
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
    <Section>
      <p className="label">{label}</p>
      <p className="mt-3.5 text-sm leading-relaxed text-muted">{children}</p>
      {href && action ? (
        <Link href={href} className="action mt-3.5 inline-block">
          {action}
        </Link>
      ) : null}
    </Section>
  );
}

/** Three numbers that say how the week is going, side by side. */
export function StatRow({
  stats,
}: {
  stats: Array<{ label: string; value: string; hint?: string }>;
}) {
  return (
    <div className="border-b border-line">
      <StatGrid>
        {stats.map((stat) => (
          <Stat
            key={stat.label}
            label={stat.label}
            value={stat.value}
            note={stat.hint}
          />
        ))}
      </StatGrid>
    </div>
  );
}

/* -------------------------------------------------------------- heatmap */

const HEAT_CLASS = [
  "bg-line-inner",
  "bg-amber/25",
  "bg-amber/45",
  "bg-amber/70",
  "bg-amber",
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
    <Panel
      title="Atividade · 3 meses"
      meta={
        <Link href="/progress" className="action">
          Ver o ano
        </Link>
      }
      note={
        daysTrained === 0
          ? "O primeiro quadrado acende no fim do primeiro treino."
          : daysTrained === 1
            ? "1 dia treinado nos últimos três meses."
            : `${daysTrained} dias treinados nos últimos três meses.`
      }
    >
      <div className="flex gap-[3px]" aria-hidden="true">
        {columns.map((week) => (
          <div key={week[0].date} className="flex flex-1 flex-col gap-[3px]">
            {week.map((cell) => (
              <span
                key={cell.date}
                className={cx("aspect-square w-full", HEAT_CLASS[cell.level])}
              />
            ))}
          </div>
        ))}
      </div>
    </Panel>
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
    <Panel
      title="Equilíbrio muscular"
      meta={
        <Link href="/progress" className="action">
          Ver o mapa
        </Link>
      }
      note={
        missing.length > 0 && worked.length > 0
          ? `Ainda por trabalhar: ${missing.join(", ")}.`
          : undefined
      }
    >
      {worked.length === 0 ? (
        <p className="text-sm leading-relaxed text-muted">
          Ainda não treinaste esta semana. Assim que fizeres a primeira série,
          aparece aqui onde é que o trabalho foi parar.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {worked.map((entry) => (
            <li
              key={entry.muscle}
              className="tabular border border-line-strong px-2.5 py-1 text-xs text-parchment"
            >
              {entry.muscle} <span className="text-faint">{entry.sets}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
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
    <Panel
      title="Esta semana"
      meta={
        <p className="display text-lg text-parchment">
          {trained}
          <span className="text-sm text-faint">/{target}</span>
        </p>
      }
      note={
        streak > 0
          ? streak === 1
            ? "Primeira semana com o objetivo cumprido."
            : `${streak} semanas seguidas com o objetivo cumprido.`
          : undefined
      }
    >
      <ul className="flex justify-between gap-1">
        {days.map((day) => (
          <li key={day.date} className="flex flex-1 flex-col items-center gap-2">
            <span
              className={cx(
                "text-[0.625rem] uppercase tracking-[0.12em]",
                day.isToday ? "text-amber" : "text-faint",
              )}
            >
              {day.initial}
            </span>
            <span
              aria-hidden="true"
              className={cx(
                "h-2.5 w-2.5 border",
                day.trained
                  ? "border-amber bg-amber"
                  : day.isToday
                    ? "border-amber bg-transparent"
                    : day.isFuture
                      ? "border-line bg-transparent"
                      : "border-line-strong bg-line-inner",
              )}
            />
            <span className="sr-only">
              {day.trained ? "treinado" : "sem treino"}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
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
    <Panel
      title="Último treino"
      meta={
        <Link href={`/session/${session.id}/summary`} className="action">
          Resumo
        </Link>
      }
    >
      <p className="display text-2xl leading-none text-parchment">
        {session.name}
      </p>
      <p className="tabular mt-2 text-sm text-muted">{facts.join(" · ")}</p>
      <p className="mt-1 text-[0.78125rem] text-faint">{session.when}</p>

      {session.records > 0 ? (
        <p className="mt-2.5 text-[0.78125rem] text-amber">
          {session.records === 1
            ? "1 recorde pessoal"
            : `${session.records} recordes pessoais`}
        </p>
      ) : null}
    </Panel>
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
    <Panel
      title="Parceiro"
      note={
        thisWeek > 0
          ? thisWeek === 1
            ? "1 treino nos últimos 7 dias"
            : `${thisWeek} treinos nos últimos 7 dias`
          : undefined
      }
    >
      <p className="text-sm leading-relaxed">
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
    </Panel>
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
  verdict,
}: {
  values: number[];
  latest: number;
  changeKg: number | null;
  weeks: number;
  /** What the trend actually means, when there is enough of it to say. */
  verdict?: { tone: "neutral" | "warn" | "good"; text: string } | null;
}) {
  const series = buildSeries(values, SPARK);
  const direction =
    changeKg === null || Math.abs(changeKg) < 0.05
      ? null
      : changeKg > 0
        ? `+${format(changeKg)} kg`
        : `−${format(Math.abs(changeKg))} kg`;

  return (
    <Panel
      title="Peso"
      meta={
        <Link href="/progress" className="action">
          Registar
        </Link>
      }
    >
      <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="display text-[2.125rem] text-parchment">
          {format(latest)}
          <span className="ml-1 text-base font-semibold normal-case text-faint">kg</span>
        </p>
        {direction ? (
          <p className="tabular mt-1 text-[0.78125rem] text-amber">
            {direction} em {weeks === 1 ? "1 semana" : `${weeks} semanas`}
          </p>
        ) : null}
      </div>

      {series ? (
        <svg
          viewBox={`0 0 ${SPARK.width} ${SPARK.height}`}
          className="h-9 w-32 shrink-0"
          role="img"
          aria-label="Evolução do peso"
        >
          <path
            d={series.path}
            className="fill-none stroke-amber [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.5]"
          />
        </svg>
      ) : null}
      </div>

      {verdict ? (
        <p
          className={cx(
            "mt-4 border-l-[3px] pl-3 text-sm leading-relaxed",
            verdict.tone === "warn"
              ? "border-oxblood text-parchment"
              : verdict.tone === "good"
                ? "border-amber text-muted"
                : "border-line-strong text-muted",
          )}
        >
          {verdict.text}
        </p>
      ) : null}
    </Panel>
  );
}

/** One decimal, comma separated, the way a weight is written in Portuguese. */
function format(kg: number): string {
  return kg.toFixed(1).replace(".", ",").replace(/,0$/, "");
}
