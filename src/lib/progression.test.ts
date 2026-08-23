import assert from "node:assert/strict";
import { test } from "node:test";
import {
  defaultPrescription,
  describeTarget,
  estimatedOneRepMax,
  formatRepTarget,
  perSideLabel,
  nextWorkingWeight,
  platesForWeight,
  sessionVolume,
  warmupSets,
} from "./progression.ts";

const done = (reps: number, targetReps: number) => ({
  reps,
  targetReps,
  completed: true,
});

test("a completed session adds one increment", () => {
  const result = nextWorkingWeight({
    family: "lower_compound",
    increment: 5,
    workingKg: 60,
    failCount: 0,
    sets: [done(5, 5), done(5, 5), done(5, 5)],
  });
  assert.equal(result.workingKg, 65);
  assert.equal(result.failCount, 0);
  assert.equal(result.action, "increase");
});

test("a missed repetition holds the weight and records a failure", () => {
  const result = nextWorkingWeight({
    family: "upper_compound",
    increment: 2.5,
    workingKg: 40,
    failCount: 0,
    sets: [done(5, 5), done(5, 5), { reps: 3, targetReps: 5, completed: true }],
  });
  assert.equal(result.workingKg, 40);
  assert.equal(result.failCount, 1);
  assert.equal(result.action, "hold");
});

test("a second consecutive failure deloads by ten per cent", () => {
  const result = nextWorkingWeight({
    family: "upper_compound",
    increment: 2.5,
    workingKg: 40,
    failCount: 1,
    sets: [done(5, 5), { reps: 2, targetReps: 5, completed: true }],
  });
  assert.equal(result.workingKg, 36);
  assert.equal(result.failCount, 0);
  assert.equal(result.action, "deload");
});

test("bodyweight movements never change their load", () => {
  const result = nextWorkingWeight({
    family: "bodyweight",
    increment: 0,
    workingKg: 0,
    failCount: 1,
    sets: [done(8, 10)],
  });
  assert.equal(result.workingKg, 0);
  assert.equal(result.action, "unchanged");
});

test("an empty session changes nothing", () => {
  const result = nextWorkingWeight({
    family: "lower_compound",
    increment: 5,
    workingKg: 60,
    failCount: 1,
    sets: [],
  });
  assert.deepEqual(result, { workingKg: 60, failCount: 1, action: "unchanged" });
});

test("warm-ups are skipped for light work and build up for heavy work", () => {
  assert.deepEqual(warmupSets(25), []);

  const sets = warmupSets(100);
  assert.ok(sets.length >= 3);
  assert.equal(sets[0].kg, 20);
  assert.ok(sets.every((set) => set.kg < 100));
  for (let i = 1; i < sets.length; i += 1) {
    assert.ok(sets[i].kg >= sets[i - 1].kg);
  }
});

test("plate loading splits the difference over the bar", () => {
  const load = platesForWeight(100);
  assert.equal(load.loadable, true);
  if (load.loadable) {
    assert.deepEqual(load.perSide, [25, 15]);
  }
});

test("plate loading reports the closest achievable weight", () => {
  const load = platesForWeight(21);
  assert.equal(load.loadable, false);
  if (!load.loadable) {
    assert.equal(load.closestKg, 20);
  }
});

test("weights below the bar are not loadable", () => {
  const load = platesForWeight(15);
  assert.equal(load.loadable, false);
});

test("one repetition maximum is the weight itself at one repetition", () => {
  assert.equal(estimatedOneRepMax(100, 1), 100);
  assert.equal(estimatedOneRepMax(100, 5), 116.5);
  assert.equal(estimatedOneRepMax(0, 5), 0);
});

test("volume counts completed working sets only", () => {
  const total = sessionVolume([
    { weightKg: 60, reps: 5, completed: true, isWarmup: false },
    { weightKg: 20, reps: 8, completed: true, isWarmup: true },
    { weightKg: 60, reps: 5, completed: false, isWarmup: false },
  ]);
  assert.equal(total, 300);
});

test("every target explains itself", () => {
  const base = { increment: 2.5, family: "upper_compound" as const, hasHistory: true };

  assert.match(
    describeTarget({ ...base, action: null, hasHistory: false }),
    /Primeira vez/,
  );
  assert.match(describeTarget({ ...base, action: "increase" }), /Subiu 2,5 kg/);
  assert.match(describeTarget({ ...base, action: "hold" }), /Mesmo peso/);
  assert.match(describeTarget({ ...base, action: "deload" }), /Desceu 10%/);
  assert.match(
    describeTarget({ ...base, action: "increase", family: "bodyweight" }),
    /uma repetição/,
  );
  assert.match(
    describeTarget({ ...base, action: "increase", increment: 5 }),
    /Subiu 5 kg/,
  );
});

test("an exercise added mid-session gets a sensible prescription", () => {
  const compound = defaultPrescription("lower_compound");
  assert.equal(compound.sets, 3);
  assert.ok(compound.repLow <= compound.repHigh);
  assert.ok(compound.restSec >= defaultPrescription("accessory").restSec);
  assert.ok(defaultPrescription("bodyweight").repHigh >= 12);
});

test("targets read correctly for reps and for holds", () => {
  assert.equal(formatRepTarget({ repLow: 5, repHigh: 5 }), "5");
  assert.equal(formatRepTarget({ repLow: 8, repHigh: 12 }), "8–12");
  assert.equal(
    formatRepTarget({ repLow: 30, repHigh: 45, isTimed: true }),
    "30–45 s",
  );
});

test("unilateral totals are shown as a split", () => {
  assert.equal(perSideLabel(20), "10 por lado");
  assert.equal(perSideLabel(15), "7+8 por lado");
  assert.equal(perSideLabel(0), null);
  assert.equal(perSideLabel(null), null);
});

test("holds and bodyweight work say when to add a set", () => {
  assert.match(
    describeTarget({
      action: "unchanged",
      increment: 0,
      family: "bodyweight",
      hasHistory: true,
      hitCeiling: true,
    }),
    /acrescenta uma série/,
  );
  assert.match(
    describeTarget({
      action: "unchanged",
      increment: 0,
      family: "bodyweight",
      hasHistory: true,
      isTimed: true,
    }),
    /segundos/,
  );
  assert.match(
    describeTarget({
      action: null,
      increment: 0,
      family: "bodyweight",
      hasHistory: false,
      isTimed: true,
    }),
    /Primeira vez/,
  );
});
