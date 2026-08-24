import {
  buildBars,
  buildSeries,
  monthLabels,
  niceTicks,
  valueToY,
  type ChartBox,
  type HeatCell,
} from "@/lib/charts";
import { cx } from "@/components/ui";

/* ------------------------------------------------------------ line chart */

/**
 * A line with numbers on it.
 *
 * The previous version drew the shape and nothing else, so you could see the
 * weight had fallen without being able to say from what to what. It now
 * carries a labelled vertical axis, the dates at either end, and the latest
 * value called out on the last point.
 *
 * Still server-rendered SVG: no charting library, nothing to hydrate, and it
 * draws with no connection.
 */
const LINE_BOX: ChartBox = {
  width: 320,
  height: 176,
  padTop: 14,
  padBottom: 26,
  padLeft: 34,
  padRight: 14,
};

export function LineChart({
  values,
  goal,
  label,
  unit = "kg",
  startLabel,
  endLabel,
}: {
  values: number[];
  goal?: number | null;
  label?: string;
  unit?: string;
  startLabel?: string;
  endLabel?: string;
}) {
  const series = buildSeries(
    values,
    LINE_BOX,
    goal !== null && goal !== undefined ? [goal] : [],
  );

  if (!series) {
    return (
      <p className="py-8 text-center text-sm text-muted">
        Ainda não há dados suficientes para desenhar.
      </p>
    );
  }

  const ticks = niceTicks(series.min, series.max);
  const goalY =
    goal !== null && goal !== undefined
      ? valueToY(goal, series, LINE_BOX)
      : null;
  const last = series.points[series.points.length - 1];
  const latest = values[values.length - 1];
  const floor = LINE_BOX.height - LINE_BOX.padBottom;

  // Keep the callout inside the box when the last point sits near the top.
  const calloutY = last.y < LINE_BOX.padTop + 12 ? last.y + 16 : last.y - 8;

  return (
    <svg
      viewBox={`0 0 ${LINE_BOX.width} ${LINE_BOX.height}`}
      className="h-auto w-full"
      role="img"
      aria-label={`${label ?? "Gráfico"}. Agora ${latest} ${unit}.`}
    >
      {ticks.map((tick) => {
        const y = valueToY(tick, series, LINE_BOX);
        if (y === null) return null;
        return (
          <g key={tick}>
            <line
              x1={LINE_BOX.padLeft}
              x2={LINE_BOX.width - LINE_BOX.padRight}
              y1={y}
              y2={y}
              className="stroke-line [stroke-width:1]"
            />
            <text
              x={LINE_BOX.padLeft - 6}
              y={y + 3}
              textAnchor="end"
              className="fill-faint text-[9px] [font-variant-numeric:tabular-nums]"
            >
              {tick}
            </text>
          </g>
        );
      })}

      <path d={series.area} className="fill-brass/10" />
      <path
        d={series.path}
        className="fill-none stroke-brass [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.5]"
      />

      {goalY !== null ? (
        <>
          <line
            x1={LINE_BOX.padLeft}
            x2={LINE_BOX.width - LINE_BOX.padRight}
            y1={goalY}
            y2={goalY}
            className="stroke-brass-dim [stroke-dasharray:3_4] [stroke-width:1]"
          />
          <text
            x={LINE_BOX.width - LINE_BOX.padRight}
            y={goalY - 4}
            textAnchor="end"
            className="fill-brass-dim text-[9px]"
          >
            objetivo
          </text>
        </>
      ) : null}

      <circle cx={last.x} cy={last.y} r={3} className="fill-brass" />
      <text
        x={last.x}
        y={calloutY}
        textAnchor="end"
        className="fill-parchment text-[10px] [font-variant-numeric:tabular-nums]"
      >
        {latest} {unit}
      </text>

      {startLabel ? (
        <text
          x={LINE_BOX.padLeft}
          y={floor + 16}
          className="fill-faint text-[9px]"
        >
          {startLabel}
        </text>
      ) : null}
      {endLabel ? (
        <text
          x={LINE_BOX.width - LINE_BOX.padRight}
          y={floor + 16}
          textAnchor="end"
          className="fill-faint text-[9px]"
        >
          {endLabel}
        </text>
      ) : null}
    </svg>
  );
}

/* ------------------------------------------------------------- bar chart */

const BAR_BOX: ChartBox = {
  width: 320,
  height: 150,
  padTop: 18,
  padBottom: 24,
  padLeft: 10,
  padRight: 10,
};

/**
 * Discrete readings belong in columns. A session's volume does not flow into
 * the next session, so a line between them draws days that were never measured.
 */
export function BarChart({
  values,
  format,
  label,
  startLabel,
  endLabel,
}: {
  values: number[];
  format: (value: number) => string;
  label?: string;
  startLabel?: string;
  endLabel?: string;
}) {
  const bars = buildBars(values, BAR_BOX);
  if (bars.length === 0) return null;

  const peak = Math.max(...values);
  const peakIndex = values.indexOf(peak);
  const floor = BAR_BOX.height - BAR_BOX.padBottom;

  return (
    <svg
      viewBox={`0 0 ${BAR_BOX.width} ${BAR_BOX.height}`}
      className="h-auto w-full"
      role="img"
      aria-label={label ?? "Gráfico de barras"}
    >
      <line
        x1={BAR_BOX.padLeft}
        x2={BAR_BOX.width - BAR_BOX.padRight}
        y1={floor}
        y2={floor}
        className="stroke-line [stroke-width:1]"
      />

      {bars.map((bar, index) => (
        <rect
          key={index}
          x={bar.x}
          y={bar.y}
          width={bar.width}
          height={Math.max(bar.height, 1)}
          rx={1}
          className={index === bars.length - 1 ? "fill-brass" : "fill-brass/40"}
        />
      ))}

      {/* Only the tallest and the latest carry a number; a label on every
          column is unreadable at this width. */}
      <text
        x={bars[peakIndex].x + bars[peakIndex].width / 2}
        y={bars[peakIndex].y - 5}
        textAnchor="middle"
        className="fill-faint text-[9px] [font-variant-numeric:tabular-nums]"
      >
        {format(peak)}
      </text>
      {peakIndex !== bars.length - 1 ? (
        <text
          x={bars[bars.length - 1].x + bars[bars.length - 1].width / 2}
          y={bars[bars.length - 1].y - 5}
          textAnchor="middle"
          className="fill-parchment text-[9px] [font-variant-numeric:tabular-nums]"
        >
          {format(values[values.length - 1])}
        </text>
      ) : null}

      {startLabel ? (
        <text
          x={BAR_BOX.padLeft}
          y={floor + 15}
          className="fill-faint text-[9px]"
        >
          {startLabel}
        </text>
      ) : null}
      {endLabel ? (
        <text
          x={BAR_BOX.width - BAR_BOX.padRight}
          y={floor + 15}
          textAnchor="end"
          className="fill-faint text-[9px]"
        >
          {endLabel}
        </text>
      ) : null}
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

const CELL = 11;
const GAP = 3;

/**
 * A year of training as a grid, one column per week, with the months labelled
 * along the top so the squares can be placed in time. It scrolls sideways on a
 * phone rather than shrinking past the point of being readable, and opens at
 * the recent end.
 */
export function Heatmap({ columns }: { columns: HeatCell[][] }) {
  const months = monthLabels(columns);
  const step = CELL + GAP;

  return (
    <div className="scroll-area overflow-x-auto pb-1" dir="rtl">
      <div dir="ltr" className="w-max">
        <div className="relative mb-1.5 h-3">
          {months.map((month) => (
            <span
              key={`${month.index}-${month.label}`}
              className="absolute top-0 text-[0.625rem] uppercase tracking-[0.1em] text-faint"
              style={{ left: month.index * step }}
            >
              {month.label}
            </span>
          ))}
        </div>

        <div className="flex" style={{ gap: GAP }}>
          {columns.map((week) => (
            <div
              key={week[0].date}
              className="flex flex-col"
              style={{ gap: GAP }}
            >
              {week.map((cell) => (
                <span
                  key={cell.date}
                  title={`${cell.date}: ${cell.value > 0 ? `${cell.value} séries` : "descanso"}`}
                  className={cx("block rounded-[2px]", HEAT_CLASS[cell.level])}
                  style={{ width: CELL, height: CELL }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function HeatmapLegend() {
  return (
    <div className="flex items-center justify-end gap-1.5">
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
    <ul className="space-y-2.5">
      {rows.map((row) => (
        <li key={row.muscle} className="flex items-center gap-3">
          <span className="w-24 shrink-0 text-xs capitalize text-muted">
            {row.muscle}
          </span>
          <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-raised">
            <span
              className={cx(
                "absolute inset-y-0 left-0 rounded-full",
                row.sets > 0 ? "bg-brass" : "bg-transparent",
              )}
              style={{ width: `${Math.round(row.share * 100)}%` }}
            />
          </span>
          <span
            className={cx(
              "tabular w-5 text-right text-xs",
              row.sets > 0 ? "text-muted" : "text-faint",
            )}
          >
            {row.sets}
          </span>
        </li>
      ))}
    </ul>
  );
}
