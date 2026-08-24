import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DURATION_SLACK_MINUTES,
  estimateMinutes,
  fitsSession,
  formatMinutes,
  type DurationItem,
} from "./duration.ts";

const item = (over: Partial<DurationItem> = {}): DurationItem => ({
  sets: 3,
  repLow: 8,
  repHigh: 12,
  restSec: 90,
  ...over,
});

test("an empty day takes no time", () => {
  assert.equal(estimateMinutes([]), 0);
});

test("rest dominates a heavy compound", () => {
  // Five repetitions are quicker than the 20 s floor, so each set costs
  // 20 + 180 s. Three of those plus four minutes of warm-up is 840 s, and
  // nothing is added after the only exercise.
  const minutes = estimateMinutes([
    item({ sets: 3, repLow: 5, repHigh: 5, restSec: 180, family: "lower_compound" }),
  ]);
  assert.equal(minutes, 14);
});

test("only the compounds carry a warm-up", () => {
  const withWarmup = estimateMinutes([
    item({ family: "upper_compound" }),
  ]);
  const without = estimateMinutes([item({ family: "accessory" })]);
  assert.equal(withWarmup - without, 4);
});

test("a hold counts its seconds rather than converting repetitions", () => {
  // 4 × (30 s hold + 60 s rest) = 360 s. Converting 30 repetitions instead
  // would have charged it 105 s a set.
  assert.equal(
    estimateMinutes([
      item({ sets: 4, repLow: 30, repHigh: 30, restSec: 60, isTimed: true }),
    ]),
    6,
  );
});

test("moving between exercises is counted, but not after the last one", () => {
  // One set of 10 repetitions is 35 s of work and 85 s of rest: 120 s.
  const one = item({ sets: 1, repLow: 10, repHigh: 10, restSec: 85 });
  assert.equal(estimateMinutes([one]), 2);
  // The second exercise brings its own 120 s and one 60 s transition.
  assert.equal(estimateMinutes([one, one]), 5);
});

test("a day has to fill the time set aside, and may run over", () => {
  const short = [item({ sets: 2, repLow: 10, repHigh: 10, restSec: 60 })];
  const long = Array.from({ length: 6 }, () =>
    item({ sets: 4, repLow: 8, repHigh: 8, restSec: 150, family: "upper_compound" }),
  );

  assert.equal(fitsSession(short, 60), false);
  assert.equal(fitsSession(long, 60), true);
});

test("the floor is the target less the slack, and running over is fine", () => {
  const items = [
    item({ sets: 4, repLow: 5, repHigh: 5, restSec: 180, family: "lower_compound" }),
    item({ sets: 4, repLow: 5, repHigh: 5, restSec: 180, family: "upper_compound" }),
    item({ sets: 3, repLow: 10, repHigh: 12, restSec: 90 }),
  ];
  const minutes = estimateMinutes(items);

  // Comfortably over the target: never rejected for being too long.
  assert.equal(fitsSession(items, minutes - 20), true);
  assert.equal(fitsSession(items, minutes), true);
  // Short by exactly the slack still passes; one minute more does not.
  assert.equal(fitsSession(items, minutes + DURATION_SLACK_MINUTES), true);
  assert.equal(fitsSession(items, minutes + DURATION_SLACK_MINUTES + 1), false);
});

test("minutes are rounded to five only for display", () => {
  assert.equal(formatMinutes(55), "~55 min");
  assert.equal(formatMinutes(43), "~45 min");
  assert.equal(formatMinutes(62), "~60 min");
});
