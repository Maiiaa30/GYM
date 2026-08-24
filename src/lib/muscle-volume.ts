/**
 * Where the work actually went.
 *
 * Counts working sets per muscle over a window, so a week of training can be
 * read at a glance — including, and especially, the muscles that received
 * nothing at all.
 */

export type LoggedSet = {
  exercise: string;
  completed: boolean;
  isWarmup: boolean;
  on: string;
};

export type MuscleShare = {
  muscle: string;
  sets: number;
  share: number;
};

/** The groups a body is read in, in the order they are shown. */
export const MUSCLE_GROUPS = [
  "peito",
  "costas",
  "dorsais",
  "ombros",
  "bíceps",
  "tríceps",
  "abdominais",
  "lombar",
  "glúteos",
  "quadríceps",
  "isquiotibiais",
  "gémeos",
] as const;

export function countSetsByMuscle(
  sets: LoggedSet[],
  muscleBySlug: Map<string, string>,
): Map<string, number> {
  const counts = new Map<string, number>();

  for (const set of sets) {
    if (!set.completed || set.isWarmup) continue;
    const muscle = muscleBySlug.get(set.exercise);
    if (!muscle) continue;
    counts.set(muscle, (counts.get(muscle) ?? 0) + 1);
  }

  return counts;
}

/**
 * Every group, including the empty ones, with each one's share of the busiest
 * group so a bar chart reads honestly.
 */
export function muscleBalance(counts: Map<string, number>): MuscleShare[] {
  const peak = Math.max(0, ...MUSCLE_GROUPS.map((m) => counts.get(m) ?? 0));

  return MUSCLE_GROUPS.map((muscle) => {
    const sets = counts.get(muscle) ?? 0;
    return { muscle, sets, share: peak === 0 ? 0 : sets / peak };
  });
}

/** The groups that received nothing in the window. */
export function untrained(balance: MuscleShare[]): string[] {
  return balance.filter((entry) => entry.sets === 0).map((entry) => entry.muscle);
}

/** Keeps only the sets on or after a cut-off date, both as ISO days. */
export function withinDays(sets: LoggedSet[], from: string): LoggedSet[] {
  return sets.filter((set) => set.on >= from);
}
