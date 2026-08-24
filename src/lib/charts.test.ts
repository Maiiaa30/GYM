import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_BOX,
  buildBars,
  buildHeatmap,
  buildSeries,
  monthLabels,
  niceTicks,
  toISODate,
  valueToY,
} from "./charts.ts";
import {
  countSetsByMuscle,
  muscleBalance,
  untrained,
  withinDays,
  MUSCLE_GROUPS,
} from "./muscle-volume.ts";

test("a series fills the box and stays inside it", () => {
  const series = buildSeries([80, 82, 79, 81]);
  assert.ok(series);
  if (!series) return;

  assert.equal(series.points.length, 4);
  for (const point of series.points) {
    assert.ok(point.x >= DEFAULT_BOX.padLeft - 0.01);
    assert.ok(point.x <= DEFAULT_BOX.width - DEFAULT_BOX.padRight + 0.01);
    assert.ok(point.y >= DEFAULT_BOX.padTop - 0.01);
    assert.ok(point.y <= DEFAULT_BOX.height - DEFAULT_BOX.padBottom + 0.01);
  }
  assert.match(series.path, /^M/);
  assert.match(series.area, /Z$/);
});

test("a single reading is drawn in the middle", () => {
  const series = buildSeries([80]);
  assert.ok(series);
  if (!series) return;
  assert.equal(
    Math.round(series.points[0].x),
    Math.round(
      DEFAULT_BOX.padLeft +
        (DEFAULT_BOX.width - DEFAULT_BOX.padLeft - DEFAULT_BOX.padRight) / 2,
    ),
  );
});

test("flat data does not divide by zero", () => {
  const series = buildSeries([80, 80, 80]);
  assert.ok(series);
  if (!series) return;
  for (const point of series.points) {
    assert.ok(Number.isFinite(point.y));
  }
});

test("no data draws nothing", () => {
  assert.equal(buildSeries([]), null);
});

test("a goal outside the readings widens the range so it can be drawn", () => {
  const series = buildSeries([80, 81], DEFAULT_BOX, [70]);
  assert.ok(series);
  if (!series) return;
  assert.ok(series.min <= 70);
  assert.ok(valueToY(70, series) !== null);
});

test("a reference line outside the range is not drawn", () => {
  const series = buildSeries([80, 81]);
  assert.ok(series);
  if (!series) return;
  assert.equal(valueToY(50, series), null);
});

test("the heatmap covers whole weeks ending this week", () => {
  const today = new Date("2026-08-24T12:00:00Z");
  const columns = buildHeatmap([], today, 4);
  assert.equal(columns.length, 4);
  for (const column of columns) assert.equal(column.length, 7);

  const flat = columns.flat();
  assert.ok(flat.some((cell) => cell.date === toISODate(today)));
  assert.ok(flat.every((cell) => cell.level === 0));
});

test("heatmap intensity is relative to the busiest day", () => {
  const today = new Date("2026-08-24T12:00:00Z");
  const columns = buildHeatmap(
    [
      { date: "2026-08-24", value: 100 },
      { date: "2026-08-23", value: 10 },
    ],
    today,
    4,
  );
  const flat = columns.flat();
  const busiest = flat.find((cell) => cell.date === "2026-08-24");
  const quiet = flat.find((cell) => cell.date === "2026-08-23");
  assert.equal(busiest?.level, 4);
  assert.equal(quiet?.level, 1);
});

test("volume is counted per muscle, warm-ups excluded", () => {
  const muscles = new Map([
    ["barbell-squat", "quadríceps"],
    ["plank", "abdominais"],
  ]);
  const counts = countSetsByMuscle(
    [
      { exercise: "barbell-squat", completed: true, isWarmup: false, on: "2026-08-24" },
      { exercise: "barbell-squat", completed: true, isWarmup: true, on: "2026-08-24" },
      { exercise: "barbell-squat", completed: false, isWarmup: false, on: "2026-08-24" },
      { exercise: "plank", completed: true, isWarmup: false, on: "2026-08-24" },
    ],
    muscles,
  );
  assert.equal(counts.get("quadríceps"), 1);
  assert.equal(counts.get("abdominais"), 1);
});

test("the balance names every group and what was missed", () => {
  const balance = muscleBalance(new Map([["quadríceps", 8], ["peito", 4]]));
  assert.equal(balance.length, MUSCLE_GROUPS.length);

  const quads = balance.find((entry) => entry.muscle === "quadríceps");
  const chest = balance.find((entry) => entry.muscle === "peito");
  assert.equal(quads?.share, 1);
  assert.equal(chest?.share, 0.5);

  const missed = untrained(balance);
  assert.ok(missed.includes("gémeos"));
  assert.ok(!missed.includes("peito"));
});

test("the window keeps only recent sets", () => {
  const sets = [
    { exercise: "a", completed: true, isWarmup: false, on: "2026-08-01" },
    { exercise: "b", completed: true, isWarmup: false, on: "2026-08-20" },
  ];
  assert.equal(withinDays(sets, "2026-08-18").length, 1);
});


/* ----------------------------------------------------------------- axes */

test("axis labels are round numbers inside the range", () => {
  const ticks = niceTicks(78.2, 84.9);
  assert.ok(ticks.length >= 2, `expected at least two ticks, got ${ticks}`);
  for (const tick of ticks) {
    assert.ok(tick >= 78.2 && tick <= 84.9, `${tick} is outside the range`);
  }
  // Snapped to a sensible step rather than the raw span.
  const step = ticks[1] - ticks[0];
  assert.ok([1, 2, 2.5, 5].includes(Math.round(step * 10) / 10), `odd step ${step}`);
});

test("a flat range still yields one label, and nonsense yields none", () => {
  assert.deepEqual(niceTicks(80, 80), [80]);
  assert.deepEqual(niceTicks(Number.NaN, 5), []);
});

test("big and small ranges both get readable steps", () => {
  const small = niceTicks(0.2, 0.9);
  const big = niceTicks(0, 12000);
  assert.ok(small.length >= 2 && big.length >= 2);
  assert.ok(big.every((tick) => Number.isInteger(tick)));
});

/* ----------------------------------------------------------------- bars */

test("bars sit inside the box and scale to the tallest", () => {
  const bars = buildBars([10, 20, 5]);
  assert.equal(bars.length, 3);

  const floor = DEFAULT_BOX.height - DEFAULT_BOX.padBottom;
  for (const bar of bars) {
    assert.ok(bar.x >= DEFAULT_BOX.padLeft - 0.01);
    assert.ok(bar.x + bar.width <= DEFAULT_BOX.width - DEFAULT_BOX.padRight + 0.01);
    assert.ok(bar.y >= DEFAULT_BOX.padTop - 0.01);
    assert.ok(Math.abs(bar.y + bar.height - floor) < 0.01, "bars stand on the floor");
  }

  // The tallest fills the height; half the value is half the height.
  assert.ok(Math.abs(bars[1].height - (DEFAULT_BOX.height - DEFAULT_BOX.padTop - DEFAULT_BOX.padBottom)) < 0.01);
  assert.ok(Math.abs(bars[0].height - bars[1].height / 2) < 0.01);
});

test("bars cope with nothing and with all zeroes", () => {
  assert.deepEqual(buildBars([]), []);
  assert.ok(buildBars([0, 0]).every((bar) => bar.height === 0));
});

/* ------------------------------------------------------------- heatmap */

test("the heatmap is labelled where the month turns over", () => {
  const columns = buildHeatmap([], new Date("2026-08-24T12:00:00Z"), 20);
  const labels = monthLabels(columns);

  assert.ok(labels.length >= 3, `expected several months, got ${labels.length}`);
  // One label per month, in order, and none of them off the end of the grid.
  const indices = labels.map((entry) => entry.index);
  assert.deepEqual(indices, [...indices].sort((a, b) => a - b));
  assert.equal(new Set(labels.map((l) => l.label)).size, labels.length);
  assert.ok(indices.every((index) => index < columns.length - 1));
});
