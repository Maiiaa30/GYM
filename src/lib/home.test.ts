import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatVolume,
  minutesBetween,
  relativeDay,
  trainedThisWeek,
  volumeOf,
  weekDays,
  weekStart,
  weekStreak,
} from "./home.ts";

/* --------------------------------------------------------------- the week */

test("the week starts on Monday", () => {
  // 2026-08-24 is a Monday, 2026-08-30 the Sunday that closes the same week.
  assert.equal(weekStart("2026-08-24"), "2026-08-24");
  assert.equal(weekStart("2026-08-30"), "2026-08-24");
  assert.equal(weekStart("2026-08-31"), "2026-08-31");
});

test("the strip marks trained days, today and the days still to come", () => {
  const days = weekDays(["2026-08-24", "2026-08-26"], "2026-08-26");

  assert.equal(days.length, 7);
  assert.deepEqual(
    days.map((day) => day.initial),
    ["S", "T", "Q", "Q", "S", "S", "D"],
  );
  assert.deepEqual(
    days.map((day) => day.trained),
    [true, false, true, false, false, false, false],
  );
  assert.equal(days[2].isToday, true);
  assert.deepEqual(
    days.map((day) => day.isFuture),
    [false, false, false, true, true, true, true],
  );
});

test("a session in another week does not appear in this one", () => {
  const days = weekDays(["2026-08-17"], "2026-08-26");
  assert.ok(days.every((day) => !day.trained));
  assert.equal(trainedThisWeek(["2026-08-17"], "2026-08-26"), 0);
});

test("the same day twice counts once", () => {
  assert.equal(
    trainedThisWeek(["2026-08-24", "2026-08-24", "2026-08-25"], "2026-08-26"),
    2,
  );
});

/* ------------------------------------------------------------- the streak */

test("weeks that met the target run consecutively", () => {
  const dates = [
    "2026-08-10", "2026-08-12", // week of the 10th
    "2026-08-17", "2026-08-19", // week of the 17th
  ];
  assert.equal(weekStreak(dates, "2026-08-24", 2), 2);
});

test("an unfinished week adds to the streak but never breaks it", () => {
  const dates = ["2026-08-17", "2026-08-19"];

  // Tuesday, one session in: the previous week still counts.
  assert.equal(weekStreak([...dates, "2026-08-25"], "2026-08-25", 2), 1);

  // Second session of the current week: it joins the streak.
  assert.equal(
    weekStreak([...dates, "2026-08-24", "2026-08-25"], "2026-08-25", 2),
    2,
  );
});

test("a missed week ends the streak", () => {
  const dates = [
    "2026-08-03", "2026-08-05", // met
    // week of the 10th missed entirely
    "2026-08-17", "2026-08-19", // met
  ];
  assert.equal(weekStreak(dates, "2026-08-24", 2), 1);
});

test("no history and no target are both zero", () => {
  assert.equal(weekStreak([], "2026-08-24", 3), 0);
  assert.equal(weekStreak(["2026-08-17"], "2026-08-24", 0), 0);
});

/* -------------------------------------------------------------- a session */

test("volume multiplies weight by repetitions", () => {
  assert.equal(
    volumeOf([
      { weightKg: 60, reps: 5 },
      { weightKg: 62.5, reps: 4 },
    ]),
    550,
  );
});

test("sets carrying no load contribute nothing", () => {
  assert.equal(
    volumeOf([
      { weightKg: null, reps: 12 },
      { weightKg: 40, reps: null },
      { weightKg: 40, reps: 10 },
    ]),
    400,
  );
});

test("duration is null while the session is still open", () => {
  assert.equal(minutesBetween("2026-08-24T18:00:00Z", null), null);
  assert.equal(
    minutesBetween("2026-08-24T18:00:00Z", "2026-08-24T18:47:00Z"),
    47,
  );
});

/* ------------------------------------------------------------ presentation */

test("volume is grouped in threes by a non-breaking space", () => {
  assert.equal(formatVolume(820), "820");
  assert.equal(formatVolume(4820), "4\u00a0820");
  assert.equal(formatVolume(12345), "12\u00a0345");
});

test("recent days read as words", () => {
  assert.equal(relativeDay("2026-08-24", "2026-08-24"), "hoje");
  assert.equal(relativeDay("2026-08-23", "2026-08-24"), "ontem");
  assert.equal(relativeDay("2026-08-21", "2026-08-24"), "há 3 dias");
  assert.equal(relativeDay("2026-08-16", "2026-08-24"), "há uma semana");
  assert.equal(relativeDay("2026-08-04", "2026-08-24"), "há 2 semanas");
  assert.equal(relativeDay("2026-06-01", "2026-08-24"), "há mais de um mês");
});
