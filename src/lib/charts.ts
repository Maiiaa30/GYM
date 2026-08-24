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
