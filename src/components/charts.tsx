import {
  DEFAULT_BOX,
  buildSeries,
  valueToY,
  type HeatCell,
} from "@/lib/charts";
import { cx } from "@/components/ui";

/* ------------------------------------------------------------ line chart */

/**
 * A static line chart. Server-rendered SVG: nothing to hydrate, nothing to
 * download, and it still draws with no connection.
 */
export function LineChart({
  values,
  goal,
  label,
}: {
  values: number[];
  goal?: number | null;
  label?: string;
}) {
  const series = buildSeries(
    values,
    DEFAULT_BOX,
    goal !== null && goal !== undefined ? [goal] : [],
  );

  if (!series) {
    return (
      <p className="px-5 py-8 text-center text-sm text-muted">
        Ainda não há dados suficientes para desenhar.
      </p>
    );
  }

  const goalY =
    goal !== null && goal !== undefined ? valueToY(goal, series) : null;
  const last = series.points[series.points.length - 1];

  return (
    <svg
      viewBox={`0 0 ${DEFAULT_BOX.width} ${DEFAULT_BOX.height}`}
      className="h-auto w-full"
      role="img"
      aria-label={label ?? "Gráfico"}
    >
      <path d={series.area} className="fill-brass/10" />
      <path
        d={series.path}
        className="fill-none stroke-brass [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.5]"
      />
      {goalY !== null ? (
        <>
          <line
            x1={DEFAULT_BOX.padLeft}
            x2={DEFAULT_BOX.width - DEFAULT_BOX.padRight}
            y1={goalY}
            y2={goalY}
            className="stroke-line-strong [stroke-dasharray:3_4] [stroke-width:1]"
          />
          <text
            x={DEFAULT_BOX.width - DEFAULT_BOX.padRight}
            y={goalY - 4}
            textAnchor="end"
            className="fill-faint text-[9px]"
          >
            objectivo
          </text>
        </>
      ) : null}
      <circle cx={last.x} cy={last.y} r={3} className="fill-brass" />
    </svg>
  );
}

/* ---------------------------------------------------------------- heatmap */

const HEAT_CLASS = [
  "bg-raised",
  "bg-brass/25",
  "bg-brass/45",
  "bg-brass/70",
  "bg-brass",
];

/**
 * A year of training as a grid, one column per week. It scrolls sideways on a
 * phone rather than shrinking the squares past the point of being readable.
 */
export function Heatmap({ columns }: { columns: HeatCell[][] }) {
  return (
    <div className="scroll-area overflow-x-auto px-5 pb-1" dir="rtl">
      <div className="flex gap-[3px]" dir="ltr">
        {columns.map((week) => (
          <div key={week[0].date} className="flex flex-col gap-[3px]">
            {week.map((cell) => (
              <span
                key={cell.date}
                title={`${cell.date}: ${cell.value > 0 ? `${cell.value} séries` : "descanso"}`}
                className={cx(
                  "block h-[9px] w-[9px] rounded-[2px]",
                  HEAT_CLASS[cell.level],
                )}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function HeatmapLegend() {
  return (
    <div className="flex items-center justify-end gap-1.5 px-5 pt-3">
      <span className="text-[0.625rem] uppercase tracking-[0.14em] text-faint">
        menos
      </span>
      {HEAT_CLASS.map((className) => (
        <span
          key={className}
          className={cx("block h-[9px] w-[9px] rounded-[2px]", className)}
        />
      ))}
      <span className="text-[0.625rem] uppercase tracking-[0.14em] text-faint">
        mais
      </span>
    </div>
  );
}

/* ------------------------------------------------------------- bar list */

export function VolumeBars({
  rows,
}: {
  rows: Array<{ muscle: string; sets: number; share: number }>;
}) {
  return (
    <ul className="space-y-2 px-5 py-4">
      {rows.map((row) => (
        <li key={row.muscle} className="flex items-center gap-3">
          <span className="w-28 shrink-0 text-xs capitalize text-muted">
            {row.muscle}
          </span>
          <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-raised">
            <span
              className="absolute inset-y-0 left-0 rounded-full bg-brass"
              style={{ width: `${Math.round(row.share * 100)}%` }}
            />
          </span>
          <span className="tabular w-6 text-right text-xs text-faint">
            {row.sets}
          </span>
        </li>
      ))}
    </ul>
  );
}
