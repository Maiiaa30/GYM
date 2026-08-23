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
  isTimed?: boolean;
  perSide?: boolean;
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
  full_gym: "um ginásio comercial com barras, rack, halteres e máquinas",
  hotel: "um quarto de hotel, sem equipamento além do peso do corpo e mobília",
  home_minimal: "em casa, com um par de halteres reguláveis e um colchão",
};

function describeMember(member: MemberContext): string {
  const parts = [
    `${member.name}: ${member.experience === "beginner" ? "principiante" : member.experience}`,
    member.age ? `${member.age} anos` : null,
    member.sex === "male" ? "homem" : member.sex === "female" ? "mulher" : null,
    member.heightCm ? `${member.heightCm} cm` : null,
    member.bodyWeightKg ? `${member.bodyWeightKg} kg` : null,
  ].filter(Boolean);

  const lifts = member.lifts
    .filter((lift) => lift.workingKg > 0)
    .map(
      (lift) =>
        `${lift.exercise} ${lift.workingKg} kg${lift.failCount > 0 ? " (estagnado)" : ""}`,
    );

  const lines = [`- ${parts.join(", ")}`];
  if (member.injuryNotes) lines.push(`  Limitações: ${member.injuryNotes}`);
  if (lifts.length > 0) lines.push(`  Cargas actuais: ${lifts.join("; ")}`);
  else lines.push("  Ainda sem histórico de treino.");

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
    ? `Bloco anterior "${context.previousBlock.name}": ${context.previousBlock.completedSessions} treinos concluídos.${
        context.previousBlock.stalledLifts.length > 0
          ? ` Estagnados em: ${context.previousBlock.stalledLifts.join(", ")}.`
          : ""
      }`
    : "Este é o primeiro bloco deles.";

  return `És um treinador de força experiente e vais escrever um bloco de treino de quatro semanas para dois amigos que treinam juntos, à mesma hora e no mesmo sítio, e que querem fazer os mesmos exercícios pela mesma ordem. São principiantes.

Local: ${PROFILE_DESCRIPTION[context.equipment]}.
Treinos por semana: ${context.daysPerWeek}.
Tempo disponível por treino: cerca de ${context.sessionMinutes} minutos.

As pessoas:
${context.members.map(describeMember).join("\n")}

${previous}

Escreve exactamente ${context.daysPerWeek} dias de treino distintos.

Regras que tens de cumprir:
- Escolhe exercícios apenas do catálogo abaixo, usando exactamente o mesmo slug.
- Cada dia tem de caber no tempo disponível: entre ${LIMITS.minItemsPerDay} e ${LIMITS.maxItemsPerDay} exercícios.
- Ordena cada dia do mais pesado e técnico para o mais leve; isolamento e core no fim.
- Entre ${LIMITS.minSets} e ${LIMITS.maxSets} séries por exercício e descanso entre ${LIMITS.minRest} e ${LIMITS.maxRest} segundos.
- Exercícios compostos entre 5 e 8 repetições, acessórios entre 8 e 15, core entre 10 e 20.
- Exercícios marcados como isometria usam segundos nos campos de repetições: entre 20 e 60.
- Exercícios marcados como unilaterais levam o total dos dois lados, sempre um número par: 16 a 24 em vez de 8 a 12 por perna.
- Nenhum exercício pode aparecer duas vezes no mesmo dia.
- Principiantes precisam de frequência, não de variedade: repete os exercícios principais ao longo da semana em vez de encher o bloco de novidades.
- Não passes de ${LIMITS.maxWeeklySetsPerMuscle} séries de trabalho por grupo muscular em toda a semana.
- Respeita todas as limitações indicadas acima: retira o que carregue uma zona assinalada por um dos dois.
- Não prescrevas cargas. Os pesos são definidos pela aplicação.

Escreve todo o texto em português europeu (de Portugal), sem termos do português do Brasil.

Campo "name": o nome do bloco, curto. Campo "focus" de cada dia: três a cinco palavras. Campo "rationale": duas ou três frases, linguagem simples, a explicar porque é que este bloco serve a estes dois. Não menciones que foi gerado automaticamente.

Catálogo:
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
