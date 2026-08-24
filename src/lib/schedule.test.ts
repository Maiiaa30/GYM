import assert from "node:assert/strict";
import { test } from "node:test";
import {
  suggestedDayIndex,
  trainingDayNames,
  trainingWeekdays,
  weekdayOf,
} from "./schedule.ts";

test("three days a week is Monday, Wednesday, Friday", () => {
  assert.deepEqual(trainingDayNames(3), ["Segunda", "Quarta", "Sexta"]);
});

test("every reasonable week has a spread and leaves Sunday last", () => {
  assert.deepEqual(trainingDayNames(1), ["Segunda"]);
  assert.deepEqual(trainingDayNames(2), ["Segunda", "Quinta"]);
  assert.deepEqual(trainingDayNames(4), [
    "Segunda",
    "Terça",
    "Quinta",
    "Sexta",
  ]);
  assert.equal(trainingDayNames(7).length, 7);
});

test("days per week is clamped to a real week", () => {
  assert.deepEqual(trainingWeekdays(0), [0]);
  assert.equal(trainingWeekdays(99).length, 7);
});

test("Monday is zero", () => {
  // 2026-08-24 is a Monday, 2026-08-30 the Sunday that closes the week.
  assert.equal(weekdayOf("2026-08-24"), 0);
  assert.equal(weekdayOf("2026-08-26"), 2);
  assert.equal(weekdayOf("2026-08-30"), 6);
});

test("a training weekday suggests its own day", () => {
  const three = { daysPerWeek: 3, completedSessions: 7 };
  assert.equal(suggestedDayIndex({ ...three, today: "2026-08-24" }), 0);
  assert.equal(suggestedDayIndex({ ...three, today: "2026-08-26" }), 1);
  assert.equal(suggestedDayIndex({ ...three, today: "2026-08-28" }), 2);
});

test("a rest day falls back to the rotation", () => {
  // Sunday is not a training day, so the count decides: 7 % 3 = 1.
  assert.equal(
    suggestedDayIndex({
      today: "2026-08-30",
      daysPerWeek: 3,
      completedSessions: 7,
    }),
    1,
  );
});
