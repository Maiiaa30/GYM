/**
 * Chart geometry.
 *
 * Everything here is pure arithmetic that turns data into coordinates, so the
 * charts themselves are plain server-rendered SVG: nothing to download, no
 * hydration, and they still draw with no connection.
 */

export type Point = { x: number; y: number };

export type Series = {
  points: Point[];
  path: string;
  area: string;
  min: number;
  max: number;
};

export type ChartBox = {
  width: number;
  height: number;
  padTop: number;
  padBottom: number;
  padLeft: number;
  padRight: number;
};

export const DEFAULT_BOX: ChartBox = {
  width: 320,
  height: 160,
  padTop: 12,
  padBottom: 20,
  padLeft: 8,
  padRight: 8,
};

/**
 * Maps values onto the box. Extra values (a goal line, for instance) widen the
 * vertical range so that they stay inside the drawing.
 */
export function buildSeries(
  values: number[],
  box: ChartBox = DEFAULT_BOX,
  include: number[] = [],
): Series | null {
  if (values.length === 0) return null;

  const all = [...values, ...include];
  const rawMin = Math.min(...all);
  const rawMax = Math.max(...all);
  const spread = rawMax - rawMin;
  const padding = spread === 0 ? Math.max(1, rawMax * 0.02) : spread * 0.12;

  const min = rawMin - padding;
  const max = rawMax + padding;

  const innerWidth = box.width - box.padLeft - box.padRight;
  const innerHeight = box.height - box.padTop - box.padBottom;

  const points = values.map((value, index) => ({
    x:
      box.padLeft +
      (values.length === 1
        ? innerWidth / 2
        : (index / (values.length - 1)) * innerWidth),
    y: box.padTop + (1 - (value - min) / (max - min)) * innerHeight,
  }));

  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${round(point.x)} ${round(point.y)}`)
    .join(" ");

  const first = points[0];
  const last = points[points.length - 1];
  const floor = box.height - box.padBottom;
  const area = `${path} L${round(last.x)} ${round(floor)} L${round(first.x)} ${round(floor)} Z`;

  return { points, path, area, min, max };
}

/** Where a horizontal reference line sits, or null when it falls outside. */
export function valueToY(
  value: number,
  series: Series,
  box: ChartBox = DEFAULT_BOX,
): number | null {
  if (value < series.min || value > series.max) return null;
  const innerHeight = box.height - box.padTop - box.padBottom;
  return box.padTop + (1 - (value - series.min) / (series.max - series.min)) * innerHeight;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/* ----------------------------------------------------------------- axes */

/**
 * Two or three round numbers to label an axis with.
 *
 * A chart without numbers on it is a shape: you can see the weight fell
 * without being able to say from what to what. The step is snapped to a 1, 2
 * or 5 times a power of ten so the labels read as weights rather than as
 * whatever the data happened to span.
 */
export function niceTicks(min: number, max: number, count = 3): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (max <= min) return [Math.round(min * 10) / 10];

  const span = max - min;
  const magnitude = Math.pow(10, Math.floor(Math.log10(span)));

  // Candidate steps, smallest first. Picking the step by the number of labels
  // it produces rather than by the raw span avoids a 6 kg range snapping to a
  // 5 kg step and leaving a single number on the axis.
  const candidates: number[] = [];
  for (const scale of [magnitude / 10, magnitude, magnitude * 10]) {
    for (const factor of [1, 2, 2.5, 5]) candidates.push(factor * scale);
  }
  candidates.sort((a, b) => a - b);

  const ticksFor = (step: number) => {
    const out: number[] = [];
    for (
      let tick = Math.ceil(min / step - 1e-9) * step;
      tick <= max + step * 1e-9 && out.length < 12;
      tick += step
    ) {
      out.push(Math.round(tick * 100) / 100);
    }
    return out;
  };

  let best: number[] = [];
  for (const step of candidates) {
    const ticks = ticksFor(step);
    if (ticks.length < 2) continue;
    // Prefer the coarsest step that still shows at least `count` labels.
    if (ticks.length >= count) best = ticks;
    else if (best.length === 0) best = ticks;
  }

  return best.length > 0 ? best : [Math.round(((min + max) / 2) * 10) / 10];
}

/* ----------------------------------------------------------------- bars */

export type Bar = { x: number; y: number; width: number; height: number };

/**
 * Columns for discrete readings. A session's volume is not a continuous
 * quantity that flows into the next one, so it belongs in bars rather than on
 * a line that implies the days between were measured.
 */
export function buildBars(values: number[], box: ChartBox = DEFAULT_BOX): Bar[] {
  if (values.length === 0) return [];

  const innerWidth = box.width - box.padLeft - box.padRight;
  const innerHeight = box.height - box.padTop - box.padBottom;
  const peak = Math.max(...values, 0);
  const slot = innerWidth / values.length;
  // A quarter of each slot becomes the gap, so wide charts do not turn into
  // one solid block and narrow ones keep the bars apart.
  const width = Math.max(2, slot * 0.7);
  const floor = box.height - box.padBottom;

  return values.map((value, index) => {
    const height = peak <= 0 ? 0 : (value / peak) * innerHeight;
    return {
      x: box.padLeft + index * slot + (slot - width) / 2,
      y: floor - height,
      width,
      height,
    };
  });
}

/* --------------------------------------------------------------- heatmap */

export type HeatDay = { date: string; value: number };
export type HeatCell = { date: string; value: number; level: number };

/**
 * A year of days ending today, arranged in columns of seven starting on a
 * Monday, with each day placed in one of five intensity bands.
 */
export function buildHeatmap(
  days: HeatDay[],
  today: Date,
  weeks = 53,
): HeatCell[][] {
  const byDate = new Map(days.map((day) => [day.date, day.value]));
  const values = days.map((day) => day.value).filter((value) => value > 0);
  const peak = values.length > 0 ? Math.max(...values) : 0;

  const end = new Date(today);
  // Monday is 0 in the layout, so shift Sunday to the end of the week.
  const weekday = (end.getDay() + 6) % 7;
  end.setDate(end.getDate() + (6 - weekday));

  const columns: HeatCell[][] = [];
  const cursor = new Date(end);
  cursor.setDate(cursor.getDate() - (weeks * 7 - 1));

  for (let week = 0; week < weeks; week += 1) {
    const column: HeatCell[] = [];
    for (let day = 0; day < 7; day += 1) {
      const date = toISODate(cursor);
      const value = byDate.get(date) ?? 0;
      column.push({ date, value, level: heatLevel(value, peak) });
      cursor.setDate(cursor.getDate() + 1);
    }
    columns.push(column);
  }

  return columns;
}

const MONTHS = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

/**
 * Where each month starts along the grid, so a year of squares has something
 * to read it against. Without this the heatmap is a texture with no dates.
 */
export function monthLabels(
  columns: HeatCell[][],
): Array<{ index: number; label: string }> {
  const out: Array<{ index: number; label: string }> = [];
  let previous = -1;

  columns.forEach((week, index) => {
    const month = Number(week[0].date.slice(5, 7)) - 1;
    if (month === previous) return;
    previous = month;
    // A label in the last column has nothing to sit over.
    if (index > columns.length - 2) return;
    out.push({ index, label: MONTHS[month] });
  });

  return out;
}

function heatLevel(value: number, peak: number): number {
  if (value <= 0 || peak <= 0) return 0;
  const ratio = value / peak;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
