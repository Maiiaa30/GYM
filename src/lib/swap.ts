/**
 * Swapping an exercise for another that does the same job.
 *
 * Two things happen in a real gym that a written plan cannot survive on its
 * own: the machine you need is taken or broken, and some days you look at the
 * workout and do not want to do it. Both are answered by the same operation —
 * keep the muscle, change the movement.
 *
 * Pure and deterministic: the same session and catalogue always produce the
 * same replacement, so a swap can be repeated and reasoned about.
 */

import type { LiftFamily } from "./database.types.ts";

export type SwapCandidate = {
  slug: string;
  muscle: string;
  family: LiftFamily;
};

/**
 * Groups near enough to stand in for one another.
 *
 * Several movements are the only one in the catalogue for their muscle — the
 * deadlift for the lower back, the hip thrust for the glutes, and in a hotel
 * room most of the list. Without somewhere to fall back to, "Trocar" simply
 * failed on them, which is worst exactly where the equipment is most likely to
 * be missing. Neighbours are close enough that the day still does what it set
 * out to do; nothing here crosses between pushing and pulling, or between the
 * upper and lower body.
 */
const RELATED: Record<string, string[]> = {
  peito: ["ombros", "tríceps"],
  ombros: ["peito", "tríceps"],
  tríceps: ["peito", "ombros"],
  costas: ["dorsais", "bíceps"],
  dorsais: ["costas", "bíceps"],
  bíceps: ["dorsais", "costas"],
  quadríceps: ["glúteos", "isquiotibiais"],
  isquiotibiais: ["glúteos", "lombar", "quadríceps"],
  glúteos: ["isquiotibiais", "quadríceps", "lombar"],
  lombar: ["isquiotibiais", "glúteos"],
  abdominais: ["lombar"],
  gémeos: ["quadríceps"],
};

/**
 * The best replacement for one exercise.
 *
 * Preference order: same muscle and same kind of movement — a barbell press
 * for a dumbbell press — then same muscle at all, then a neighbouring muscle,
 * again preferring the same kind of movement. Anything already in the session,
 * or already rejected, is excluded, so swapping twice moves on rather than
 * offering the same thing back.
 */
export function pickAlternative(input: {
  current: SwapCandidate;
  catalogue: SwapCandidate[];
  exclude: string[];
}): SwapCandidate | null {
  const blocked = new Set([...input.exclude, input.current.slug]);

  // Stable order regardless of how the catalogue arrived.
  const available = input.catalogue
    .filter((entry) => !blocked.has(entry.slug))
    .sort((a, b) => a.slug.localeCompare(b.slug));

  const sameMuscle = available.filter(
    (entry) => entry.muscle === input.current.muscle,
  );
  const neighbours = RELATED[input.current.muscle] ?? [];
  const nearby = available.filter((entry) => neighbours.includes(entry.muscle));

  const sameFamily = (list: SwapCandidate[]) =>
    list.find((entry) => entry.family === input.current.family);

  return (
    sameFamily(sameMuscle) ??
    sameMuscle[0] ??
    sameFamily(nearby) ??
    nearby[0] ??
    null
  );
}

export type SwapResult = {
  /** Position in the original list, so the order of the day is kept. */
  position: number;
  from: string;
  to: string;
};

/**
 * Replacements for a whole day.
 *
 * Exercises that have already been worked are left alone — swapping away a set
 * someone has done would lose it — and each replacement joins the exclusion
 * list so the day does not end up with the same movement twice.
 */
export function swapDay(input: {
  items: Array<{
    position: number;
    slug: string;
    touched: boolean;
    rejected?: string[];
  }>;
  catalogue: SwapCandidate[];
}): SwapResult[] {
  const bySlug = new Map(input.catalogue.map((entry) => [entry.slug, entry]));
  const exclude = input.items.map((item) => item.slug);
  const swaps: SwapResult[] = [];

  for (const item of input.items) {
    if (item.touched) continue;

    const current = bySlug.get(item.slug);
    if (!current) continue;

    const alternative = pickAlternative({
      current,
      catalogue: input.catalogue,
      exclude: [...exclude, ...(item.rejected ?? [])],
    });
    if (!alternative) continue;

    exclude.push(alternative.slug);
    swaps.push({ position: item.position, from: item.slug, to: alternative.slug });
  }

  return swaps;
}
