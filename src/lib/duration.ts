/**
 * How long a training day takes.
 *
 * The session length in the settings used to be a sentence in the prompt and
 * nothing else, so a generated day could come back at half the time they had
 * set aside. This turns a prescription into minutes, which is what the
 * generator is now held to and what the plan shows.
 *
 * It is an estimate and says so on screen. The parts it can count — sets, rest,
 * warm-ups, moving between stations — are the parts that dominate.
 */

import type { LiftFamily } from "./database.types.ts";

/** Seconds a single repetition takes, at a controlled beginner tempo. */
const SECONDS_PER_REP = 3.5;

/** No working set is over in less than this, even at three repetitions. */
const MIN_SET_SECONDS = 20;

/** Finding the next station, loading it, and getting set. */
const TRANSITION_SECONDS = 60;

/**
 * Warm-up sets are built by the progression engine when the working weight is
 * heavy enough, which in practice means the barbell and machine compounds.
 */
const WARMUP_SECONDS = 240;

export type DurationItem = {
  sets: number;
  repLow: number;
  repHigh: number;
  restSec: number;
  isTimed?: boolean;
  family?: LiftFamily;
};

function warmsUp(family: LiftFamily | undefined): boolean {
  return family === "lower_compound" || family === "upper_compound";
}

/** Seconds spent under load on one set. */
function workSeconds(item: DurationItem): number {
  const average = (item.repLow + item.repHigh) / 2;
  // A hold already counts in seconds; repetitions have to be converted.
  if (item.isTimed) return average;
  return Math.max(MIN_SET_SECONDS, average * SECONDS_PER_REP);
}

/** Whole minutes for one training day. */
export function estimateMinutes(items: DurationItem[]): number {
  if (items.length === 0) return 0;

  let seconds = 0;

  for (const item of items) {
    const sets = Math.max(0, item.sets);
    seconds += sets * (workSeconds(item) + item.restSec);
    if (warmsUp(item.family)) seconds += WARMUP_SECONDS;
    seconds += TRANSITION_SECONDS;
  }

  // The last exercise is not followed by a walk to anywhere.
  seconds -= TRANSITION_SECONDS;

  return Math.round(seconds / 60);
}

/**
 * A day has to fill the time they set aside. Running over is fine — some
 * sessions simply take longer — so only the floor is enforced, with a few
 * minutes of slack so a 57-minute day is not rejected as too short.
 */
export const DURATION_SLACK_MINUTES = 5;

export function fitsSession(
  items: DurationItem[],
  sessionMinutes: number,
): boolean {
  return estimateMinutes(items) >= sessionMinutes - DURATION_SLACK_MINUTES;
}

/**
 * "~55 min". Rounded to five minutes only here, at the point of display: the
 * estimate itself stays exact so it can be compared against the setting
 * without a rounding step deciding whether a day fits.
 */
export function formatMinutes(minutes: number): string {
  return `~${Math.round(minutes / 5) * 5} min`;
}
