import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_BOX,
  buildHeatmap,
  buildSeries,
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
