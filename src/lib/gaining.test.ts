import assert from "node:assert/strict";
import { test } from "node:test";
import {
  describeTrend,
  directionOf,
  readTrend,
  type WeightReading,
} from "./gaining.ts";

const TODAY = "2026-08-24";

/** Weekly readings ending today, oldest first. */
function weekly(values: number[], endOn = TODAY): WeightReading[] {
  const end = Date.parse(endOn);
  return values.map((kg, index) => ({
    on: new Date(end - (values.length - 1 - index) * 7 * 86_400_000)
      .toISOString()
      .slice(0, 10),
    kg,
  }));
}

/* ------------------------------------------------------------- direction */

test("the goal says which way they are trying to go", () => {
  assert.equal(directionOf(62, 70), "gain");
  assert.equal(directionOf(80, 74), "lose");
  assert.equal(directionOf(62, null), "unknown");
  // A goal within a kilo of where they already are decides nothing.
  assert.equal(directionOf(62, 62.5), "unknown");
});

/* --------------------------------------------------------------- reading */

test("nothing is claimed before there is enough to read", () => {
  assert.equal(
    readTrend({ readings: weekly([62]), sessions: 4, direction: "gain", today: TODAY })
      .state,
    "too-soon",
  );
  // Two readings a week apart is not a trend.
  assert.equal(
    readTrend({ readings: weekly([62, 62.4]), sessions: 4, direction: "gain", today: TODAY })
      .state,
    "too-soon",
  );
});

test("a flat scale with the training done is the food, and says so", () => {
  const verdict = readTrend({
    readings: weekly([62.0, 62.2, 61.9, 62.1, 62.0]),
    sessions: 12,
    direction: "gain",
    today: TODAY,
  });

  assert.equal(verdict.state, "stuck");
  const said = describeTrend(verdict, "gain");
  assert.ok(said);
  assert.match(said.text, /comer mais/);
  assert.equal(said.tone, "warn");
});

test("a flat scale with barely any training is not about food", () => {
  const verdict = readTrend({
    readings: weekly([62.0, 62.2, 61.9, 62.1, 62.0]),
    sessions: 2,
    direction: "gain",
    today: TODAY,
  });

  assert.equal(verdict.state, "not-training");
  const said = describeTrend(verdict, "gain");
  assert.ok(said);
  assert.doesNotMatch(said.text, /comer/);
  assert.match(said.text, /treinos são seguidos/);
});

test("training hard and losing weight is called out plainly", () => {
  const verdict = readTrend({
    readings: weekly([63.5, 63.0, 62.6, 62.2, 61.8]),
    sessions: 14,
    direction: "gain",
    today: TODAY,
  });

  assert.equal(verdict.state, "wrong-way");
  const said = describeTrend(verdict, "gain");
  assert.ok(said);
  assert.match(said.text, /não estás a comer o suficiente/);
});

test("gaining when gaining is the point gets left alone", () => {
  const verdict = readTrend({
    readings: weekly([62.0, 62.4, 62.9, 63.4, 63.9]),
    sessions: 13,
    direction: "gain",
    today: TODAY,
  });

  assert.equal(verdict.state, "on-track");
  const said = describeTrend(verdict, "gain");
  assert.ok(said);
  assert.equal(said.tone, "good");
});

test("the same numbers read the other way round when the goal is to lose", () => {
  const readings = weekly([62.0, 62.4, 62.9, 63.4, 63.9]);
  assert.equal(
    readTrend({ readings, sessions: 13, direction: "lose", today: TODAY }).state,
    "wrong-way",
  );
});

test("with no goal set, a moving scale is reported and not judged", () => {
  const verdict = readTrend({
    readings: weekly([62.0, 61.5, 61.0, 60.6, 60.2]),
    sessions: 13,
    direction: "unknown",
    today: TODAY,
  });
  assert.equal(verdict.state, "on-track");
});

test("readings older than the window are ignored", () => {
  const old: WeightReading[] = [
    { on: "2026-01-01", kg: 55 },
    ...weekly([62.0, 62.1, 62.0, 62.2, 62.1]),
  ];
  const verdict = readTrend({
    readings: old,
    sessions: 12,
    direction: "gain",
    today: TODAY,
  });

  // The January reading would have shown a seven-kilo gain if it counted.
  assert.equal(verdict.state, "stuck");
});

test("nothing is said at all when there is nothing to say", () => {
  const verdict = readTrend({ readings: [], sessions: 0, direction: "gain", today: TODAY });
  assert.equal(verdict.state, "too-soon");
  assert.equal(describeTrend(verdict, "gain"), null);
});
