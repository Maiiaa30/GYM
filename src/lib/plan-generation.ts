/**
 * Programme generation: the prompt, the response schema and — most
 * importantly — the validation that stands between a generated document and
 * the database.
 *
 * The generator chooses exercises, order and rep ranges. It never chooses
 * loads: those come from the progression engine.
 */

import type { EquipmentProfile, LiftFamily } from "@/lib/database.types";

export type GeneratedItem = {
  exercise: string;
  sets: number;
  rep_low: number;
  rep_high: number;
  rest_sec: number;
  notes?: string;
};

export type GeneratedDay = {
  name: string;
  focus: string;
  items: GeneratedItem[];
};

export type GeneratedPlan = {
  name: string;
  rationale: string;
  days: GeneratedDay[];
};

export type CatalogueEntry = {
  slug: string;
  name: string;
  primary_muscle: string;
  equipment: string;
  family: LiftFamily;
};

export type MemberContext = {
  name: string;
  heightCm: number | null;
  bodyWeightKg: number | null;
  age: number | null;
  sex: string | null;
  experience: string;
  injuryNotes: string | null;
  lifts: Array<{ exercise: string; workingKg: number; failCount: number }>;
};

export type PlanContext = {
  members: MemberContext[];
  daysPerWeek: number;
  sessionMinutes: number;
  equipment: EquipmentProfile;
  catalogue: CatalogueEntry[];
  previousBlock: {
    name: string;
    completedSessions: number;
    stalledLifts: string[];
  } | null;
};

/* ------------------------------------------------------------------ limits */

export const LIMITS = {
  minItemsPerDay: 3,
  maxItemsPerDay: 8,
  maxSets: 6,
  minSets: 1,
  minReps: 1,
  maxReps: 60,
  minRest: 30,
  maxRest: 300,
  maxWeeklySetsPerMuscle: 25,
};

/* ------------------------------------------------------------------ schema */

export function planResponseSchema(allowedSlugs: string[]) {
  return {
    type: "object",
    required: ["name", "rationale", "days"],
    properties: {
      name: { type: "string" },
      rationale: { type: "string" },
      days: {
        type: "array",
        items: {
          type: "object",
          required: ["name", "focus", "items"],
          properties: {
            name: { type: "string" },
            focus: { type: "string" },
            items: {
              type: "array",
              items: {
                type: "object",
                required: ["exercise", "sets", "rep_low", "rep_high", "rest_sec"],
                properties: {
                  exercise: { type: "string", enum: allowedSlugs },
                  sets: { type: "integer" },
                  rep_low: { type: "integer" },
                  rep_high: { type: "integer" },
                  rest_sec: { type: "integer" },
                  notes: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
  };
}

/* ------------------------------------------------------------------ prompt */

const PROFILE_DESCRIPTION: Record<EquipmentProfile, string> = {
  full_gym: "a commercial gym with barbells, a rack, dumbbells and machines",
  hotel: "a hotel room with no equipment beyond bodyweight and furniture",
  home_minimal: "home, with a pair of adjustable dumbbells and a mat",
};

function describeMember(member: MemberContext): string {
  const parts = [
    `${member.name}: ${member.experience}`,
    member.age ? `${member.age} years old` : null,
    member.sex && member.sex !== "undisclosed" ? member.sex : null,
    member.heightCm ? `${member.heightCm} cm` : null,
    member.bodyWeightKg ? `${member.bodyWeightKg} kg` : null,
  ].filter(Boolean);

  const lifts = member.lifts
    .filter((lift) => lift.workingKg > 0)
    .map(
      (lift) =>
        `${lift.exercise} ${lift.workingKg} kg${lift.failCount > 0 ? " (stalling)" : ""}`,
    );

  const lines = [`- ${parts.join(", ")}`];
  if (member.injuryNotes) lines.push(`  Limitations: ${member.injuryNotes}`);
  if (lifts.length > 0) lines.push(`  Current working weights: ${lifts.join("; ")}`);
  else lines.push("  No training history yet.");

  return lines.join("\n");
}

export function buildPrompt(context: PlanContext): string {
  const catalogue = context.catalogue
    .map(
      (entry) =>
        `${entry.slug} — ${entry.name} (${entry.primary_muscle}, ${entry.equipment}, ${entry.family})`,
    )
    .join("\n");

  const previous = context.previousBlock
    ? `Previous block "${context.previousBlock.name}": ${context.previousBlock.completedSessions} sessions completed.${
        context.previousBlock.stalledLifts.length > 0
          ? ` Stalling on: ${context.previousBlock.stalledLifts.join(", ")}.`
          : ""
      }`
    : "This is their first block.";

  return `You are an experienced strength coach writing a four-week training block for two friends who train together at the same time, in the same place, and want to do the same exercises in the same order. They are beginners.

Setting: ${PROFILE_DESCRIPTION[context.equipment]}.
Sessions per week: ${context.daysPerWeek}.
Time available per session: about ${context.sessionMinutes} minutes.

The people:
${context.members.map(describeMember).join("\n")}

${previous}

Write exactly ${context.daysPerWeek} distinct training days.

Rules you must follow:
- Choose exercises only from the catalogue below, using the exact slug.
- Every day must be completable within the time available: ${LIMITS.minItemsPerDay} to ${LIMITS.maxItemsPerDay} exercises.
- Order each day heaviest and most technical first, isolation and core last.
- Between ${LIMITS.minSets} and ${LIMITS.maxSets} sets per exercise, rest between ${LIMITS.minRest} and ${LIMITS.maxRest} seconds.
- Compound lifts belong in the 5 to 8 repetition range, accessories in 8 to 15, core work in 10 to 20. Timed holds use seconds in the repetition fields and must say so in the notes.
- No exercise may appear twice on the same day.
- Beginners need frequency, not variety: repeat the main lifts across the week rather than filling the block with novelty.
- Do not exceed ${LIMITS.maxWeeklySetsPerMuscle} working sets per muscle group across the whole week.
- Respect every limitation listed above: omit anything that loads an area a member has flagged.
- Do not prescribe weights. Loads are set by the application.

The rationale field: two or three sentences, plain language, explaining why this block suits these two people. Do not mention that it was generated.

Catalogue:
${catalogue}`;
}

/* -------------------------------------------------------------- validation */

export type ValidationResult =
  | { ok: true; plan: GeneratedPlan }
  | { ok: false; errors: string[] };

export function validateGeneratedPlan(
  candidate: unknown,
  context: { expectedDays: number; catalogue: CatalogueEntry[] },
): ValidationResult {
  const errors: string[] = [];
  const bySlug = new Map(context.catalogue.map((entry) => [entry.slug, entry]));

  if (typeof candidate !== "object" || candidate === null) {
    return { ok: false, errors: ["response is not an object"] };
  }

  const plan = candidate as Partial<GeneratedPlan>;

  if (typeof plan.name !== "string" || plan.name.trim().length === 0) {
    errors.push("missing name");
  }
  if (typeof plan.rationale !== "string" || plan.rationale.trim().length === 0) {
    errors.push("missing rationale");
  }
  if (!Array.isArray(plan.days)) {
    return { ok: false, errors: [...errors, "missing days"] };
  }
  if (plan.days.length !== context.expectedDays) {
    errors.push(
      `expected ${context.expectedDays} days, received ${plan.days.length}`,
    );
  }

  const weeklySetsPerMuscle = new Map<string, number>();

  plan.days.forEach((day, dayIndex) => {
    const where = `day ${dayIndex + 1}`;

    if (typeof day?.name !== "string" || day.name.trim().length === 0) {
      errors.push(`${where}: missing name`);
    }
    if (!Array.isArray(day?.items)) {
      errors.push(`${where}: missing items`);
      return;
    }
    if (
      day.items.length < LIMITS.minItemsPerDay ||
      day.items.length > LIMITS.maxItemsPerDay
    ) {
      errors.push(`${where}: ${day.items.length} exercises is out of range`);
    }

    const seen = new Set<string>();

    day.items.forEach((item, itemIndex) => {
      const at = `${where}, exercise ${itemIndex + 1}`;
      const entry = bySlug.get(item?.exercise);

      if (!entry) {
        errors.push(`${at}: unknown exercise "${item?.exercise}"`);
        return;
      }
      if (seen.has(item.exercise)) {
        errors.push(`${at}: ${item.exercise} appears twice on the same day`);
      }
      seen.add(item.exercise);

      if (
        !Number.isInteger(item.sets) ||
        item.sets < LIMITS.minSets ||
        item.sets > LIMITS.maxSets
      ) {
        errors.push(`${at}: ${item.sets} sets is out of range`);
      }
      if (
        !Number.isInteger(item.rep_low) ||
        !Number.isInteger(item.rep_high) ||
        item.rep_low < LIMITS.minReps ||
        item.rep_high > LIMITS.maxReps ||
        item.rep_high < item.rep_low
      ) {
        errors.push(`${at}: repetition range ${item.rep_low}–${item.rep_high} is invalid`);
      }
      if (
        !Number.isInteger(item.rest_sec) ||
        item.rest_sec < LIMITS.minRest ||
        item.rest_sec > LIMITS.maxRest
      ) {
        errors.push(`${at}: ${item.rest_sec} seconds of rest is out of range`);
      }

      const sets = Number.isInteger(item.sets) ? item.sets : 0;
      weeklySetsPerMuscle.set(
        entry.primary_muscle,
        (weeklySetsPerMuscle.get(entry.primary_muscle) ?? 0) + sets,
      );
    });
  });

  for (const [muscle, sets] of weeklySetsPerMuscle) {
    if (sets > LIMITS.maxWeeklySetsPerMuscle) {
      errors.push(`${muscle}: ${sets} weekly sets exceeds the safe limit`);
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, plan: plan as GeneratedPlan };
}
