import assert from "node:assert/strict";
import { test } from "node:test";
import { dayIn, daysFromToday, today } from "./clock.ts";

test("a late session belongs to the day it was trained, not to UTC", () => {
  // 00:30 in Lisbon during summer time is 23:30 UTC the day before. Reading
  // the date off `toISOString()` filed it under the 23rd.
  const lateAugust = new Date("2026-08-23T23:30:00Z");
  assert.equal(lateAugust.toISOString().slice(0, 10), "2026-08-23");
  assert.equal(dayIn(lateAugust), "2026-08-24");
});

test("in winter Lisbon is on UTC and nothing moves", () => {
  const lateJanuary = new Date("2026-01-23T23:30:00Z");
  assert.equal(dayIn(lateJanuary), "2026-01-23");
});

test("midday is never in doubt, in either season", () => {
  assert.equal(dayIn(new Date("2026-08-24T12:00:00Z")), "2026-08-24");
  assert.equal(dayIn(new Date("2026-01-24T12:00:00Z")), "2026-01-24");
});

test("the shape is the one every date column uses", () => {
  assert.match(today(), /^\d{4}-\d{2}-\d{2}$/);
});

test("offsets count whole days in either direction", () => {
  const now = today();
  assert.equal(daysFromToday(0), now);
  assert.notEqual(daysFromToday(-7), now);
  assert.ok(daysFromToday(-7) < now);
  assert.ok(daysFromToday(1) > now);
});
