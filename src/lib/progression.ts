/**
 * Load progression.
 *
 * Deliberately deterministic and dependency free: the numbers a beginner
 * should lift next session follow from what they lifted last session, and
 * nothing else. Every rule here is capped, so no input can produce a jump
 * larger than one increment.
 */

import type { LiftFamily } from "@/lib/database.types";

export const BAR_WEIGHT_KG = 20;

/** Deload once this many consecutive failures have been recorded. */
export const FAILURES_BEFORE_DELOAD = 2;

/** Fraction of the working weight kept when deloading. */
export const DELOAD_FACTOR = 0.9;

export type SetResult = {
  reps: number;
  targetReps: number;
  completed: boolean;
};

export type ProgressionInput = {
  family: LiftFamily;
  increment: number;
  workingKg: number;
  failCount: number;
  sets: SetResult[];
};

export type ProgressionOutcome = {
  workingKg: number;
  failCount: number;
  action: "increase" | "hold" | "deload" | "unchanged";
};

/** Rounds to the smallest change that can actually be loaded on a bar. */
export function roundToLoadable(weightKg: number, step = 0.5): number {
  return Math.max(0, Math.round(weightKg / step) * step);
}

/** True when every working set reached its repetition target. */
export function allSetsCompleted(sets: SetResult[]): boolean {
  return (
    sets.length > 0 &&
    sets.every((set) => set.completed && set.reps >= set.targetReps)
  );
}

/**
 * The next working weight.
 *
 * Bodyweight movements carry no load, so they progress by repetitions and the
 * weight is left alone.
 */
export function nextWorkingWeight(
  input: ProgressionInput,
): ProgressionOutcome {
  const { family, increment, workingKg, failCount, sets } = input;

  if (sets.length === 0) {
    return { workingKg, failCount, action: "unchanged" };
  }

  if (family === "bodyweight" || increment <= 0) {
    return { workingKg, failCount: 0, action: "unchanged" };
  }

  if (allSetsCompleted(sets)) {
    return {
      workingKg: roundToLoadable(workingKg + increment),
      failCount: 0,
      action: "increase",
    };
  }

  const failures = failCount + 1;

  if (failures >= FAILURES_BEFORE_DELOAD) {
    return {
      workingKg: roundToLoadable(workingKg * DELOAD_FACTOR),
      failCount: 0,
      action: "deload",
    };
  }

  return { workingKg, failCount: failures, action: "hold" };
}

/**
 * Warm-up sets leading into the working weight. Returns an empty list for
 * light or unloaded work, where warming up with the bar is enough.
 */
export function warmupSets(workingKg: number): Array<{ kg: number; reps: number }> {
  if (workingKg <= BAR_WEIGHT_KG * 1.5) return [];

  return [
    { kg: roundToLoadable(BAR_WEIGHT_KG, 2.5), reps: 8 },
    { kg: roundToLoadable(workingKg * 0.55, 2.5), reps: 5 },
    { kg: roundToLoadable(workingKg * 0.75, 2.5), reps: 3 },
    { kg: roundToLoadable(workingKg * 0.9, 2.5), reps: 1 },
  ].filter((set) => set.kg < workingKg && set.kg >= BAR_WEIGHT_KG);
}

/** Epley estimate, used only to rank personal records. */
export function estimatedOneRepMax(weightKg: number, reps: number): number {
  if (reps <= 0 || weightKg <= 0) return 0;
  if (reps === 1) return weightKg;
  return roundToLoadable(weightKg * (1 + reps / 30), 0.5);
}

/** Plates available on each side, heaviest first, in kilograms. */
export const DEFAULT_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];

export type PlateLoad =
  | { loadable: true; perSide: number[]; barKg: number }
  | { loadable: false; closestKg: number; barKg: number };

/**
 * Works out which plates go on each side of the bar. Beginners lose minutes
 * to this arithmetic between sets.
 */
export function platesForWeight(
  totalKg: number,
  barKg = BAR_WEIGHT_KG,
  plates = DEFAULT_PLATES,
): PlateLoad {
  if (totalKg < barKg) {
    return { loadable: false, closestKg: barKg, barKg };
  }

  let remainingPerSide = (totalKg - barKg) / 2;
  const perSide: number[] = [];

  for (const plate of plates) {
    while (remainingPerSide >= plate - 1e-9) {
      perSide.push(plate);
      remainingPerSide -= plate;
    }
  }

  if (remainingPerSide > 1e-9) {
    const loaded = perSide.reduce((sum, plate) => sum + plate, 0);
    return { loadable: false, closestKg: barKg + loaded * 2, barKg };
  }

  return { loadable: true, perSide, barKg };
}

/** Total tonnage of a session: completed working sets only. */
export function sessionVolume(
  sets: Array<{ weightKg: number | null; reps: number | null; completed: boolean; isWarmup: boolean }>,
): number {
  return sets.reduce((total, set) => {
    if (!set.completed || set.isWarmup) return total;
    return total + (set.weightKg ?? 0) * (set.reps ?? 0);
  }, 0);
}
