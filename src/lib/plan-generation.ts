/**
 * Programme generation: the prompt, the response schema and — most
 * importantly — the validation that stands between a generated document and
 * the database.
 *
 * The generator chooses exercises, order and rep ranges. It never chooses
 * loads: those come from the progression engine.
 */

import type { EquipmentProfile, LiftFamily } from "@/lib/database.types";
import { estimateMinutes, fitsSession } from "./duration.ts";
import { trainingDayNames } from "./schedule.ts";

export type GeneratedItem = {
  exercise: string;
  sets: number;
  rep_low: number;
  rep_high: number;
  rest_sec: number;
  notes?: string;
};

/**
 * The model chooses the movements and describes the day; the name comes from
 * the weekday the day falls on, which is decided here rather than invented.
 */
export type GeneratedDay = {
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
  weightGoalKg: number | null;
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
    /** Every exercise the last plan used, so this one is not a copy of it. */
    exercises: string[];
  } | null;
};

/* ------------------------------------------------------------------ limits */

/**
 * The repetition ranges that follow from what these two actually want: some
 * muscle and a habit, not a competition total. They asked for sets of ten or
 * more, which is also what makes a set worth doing at a weight light enough to
 * learn the movement on.
 *
 * Bounds are wider than the prompt asks for, so only a genuinely wrong answer
 * is rejected rather than a slightly-off one. Unilateral work is halved first,
 * because it is logged as the total across both sides.
 */
export const REP_RANGES: Record<string, { low: number; high: number }> = {
  timed: { low: 15, high: 90 },
  // Pull-ups and dips are the exception: you cannot take weight off yourself,
  // so ten is not a floor a beginner can meet on those.
  bodyweight: { low: 5, high: 30 },
  lower_compound: { low: 10, high: 20 },
  upper_compound: { low: 10, high: 20 },
  accessory: { low: 10, high: 25 },
};

export function repRangeFor(entry: CatalogueEntry) {
  if (entry.isTimed) return REP_RANGES.timed;
  return REP_RANGES[entry.family] ?? REP_RANGES.accessory;
}

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
          required: ["focus", "items"],
          properties: {
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
    // The clearest statement of intent either of them has made.
    member.weightGoalKg && member.bodyWeightKg
      ? `quer chegar aos ${member.weightGoalKg} kg`
      : member.weightGoalKg
        ? `objetivo ${member.weightGoalKg} kg`
        : null,
  ].filter(Boolean);

  const lifts = member.lifts
    .filter((lift) => lift.workingKg > 0)
    .map(
      (lift) =>
        `${lift.exercise} ${lift.workingKg} kg${lift.failCount > 0 ? " (estagnado)" : ""}`,
    );

  const lines = [`- ${parts.join(", ")}`];
  if (member.injuryNotes) lines.push(`  Limitações: ${member.injuryNotes}`);
  if (lifts.length > 0) lines.push(`  Cargas atuais: ${lifts.join("; ")}`);
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
    ? [
        `Plano anterior "${context.previousBlock.name}": ${context.previousBlock.completedSessions} treinos concluídos.`,
        context.previousBlock.stalledLifts.length > 0
          ? `Estagnados em: ${context.previousBlock.stalledLifts.join(", ")}.`
          : null,
        context.previousBlock.exercises.length > 0
          ? `Exercícios que já andaram a fazer: ${context.previousBlock.exercises.join(", ")}.`
          : null,
      ]
        .filter(Boolean)
        .join("\n")
    : "É o primeiro plano deles: nunca treinaram a sério.";

  return `Vais escrever um plano de treino de quatro semanas para dois amigos que treinam juntos, à mesma hora e no mesmo sítio, e que querem fazer os mesmos exercícios pela mesma ordem.

São principiantes e são magros. Querem ganhar algum músculo, ficar mais fortes pelo caminho e, acima de tudo, criar o hábito de ir ao ginásio. Não querem treinar como atletas nem ficar enormes — querem um plano que consigam manter durante meses e que não os deixe de rastos.

Local: ${PROFILE_DESCRIPTION[context.equipment]}.
Treinos por semana: ${context.daysPerWeek}, em ${trainingDayNames(context.daysPerWeek).join(", ")}.
Duração de cada treino: pelo menos ${context.sessionMinutes} minutos. Podem passar um pouco disso, mas nunca ficar abaixo.

As pessoas:
${context.members.map(describeMember).join("\n")}

${previous}

Escreve exatamente ${context.daysPerWeek} dias de treino distintos.

Regras que tens de cumprir:
- Escolhe exercícios apenas do catálogo abaixo, usando exatamente o mesmo slug.
- Entre ${LIMITS.minItemsPerDay} e ${LIMITS.maxItemsPerDay} exercícios por dia.
- Cada dia tem de encher os ${context.sessionMinutes} minutos. Na prática são cerca de ${Math.max(3, Math.round(context.sessionMinutes / 10))} exercícios com 3 ou 4 séries cada. Com menos do que isso o treino acaba cedo demais e é recusado.
- Ordena cada dia do mais pesado e técnico para o mais leve; isolamento e core no fim.
- Entre ${LIMITS.minSets} e ${LIMITS.maxSets} séries por exercício e descanso entre ${LIMITS.minRest} e ${LIMITS.maxRest} segundos.
- Nunca prescrevas séries com menos de 10 repetições. É a forma como eles gostam de treinar e é o que lhes dá músculo com pesos que ainda conseguem controlar. Séries de 3 a 5 repetições são para levantadores experientes.
- Exercícios compostos entre 10 e 15 repetições, acessórios entre 12 e 20, core entre 15 e 25.
- Exceção: exercícios com o peso do corpo em que se puxa o próprio peso — elevações na barra, fundos — podem levar menos, porque não se lhes pode tirar carga. Aí escreve 6 a 10.
- Exercícios marcados como isometria usam segundos nos campos de repetições: entre 20 e 60.
- Exercícios marcados como unilaterais levam o total dos dois lados, sempre um número par: 16 a 24 em vez de 8 a 12 por perna.
- Nenhum exercício pode aparecer duas vezes no mesmo dia.
- Dentro da mesma semana, repete os exercícios principais em vez de encher os dias de novidades: principiantes precisam de praticar o mesmo movimento várias vezes.
- Entre planos é ao contrário. Mantém os movimentos grandes que já andam a fazer — é neles que estão a progredir — mas troca boa parte dos acessórios por outros que trabalhem os mesmos músculos. Fazer o mesmo plano outra vez farta-os e não acrescenta nada.
- Se algum exercício aparecer na lista de estagnados, troca-o por outro para o mesmo músculo: já não está a dar.
- Não passes de ${LIMITS.maxWeeklySetsPerMuscle} séries de trabalho por grupo muscular em toda a semana.
- Respeita todas as limitações indicadas acima: retira o que carregue uma zona assinalada por um dos dois.
- Não prescrevas cargas. Os pesos são definidos pela aplicação.

Escreve todo o texto em português europeu (de Portugal), sem termos do português do Brasil.

Campo "name": o nome do plano, curto e simples. Não lhe chames "bloco" nem uses palavras de ginásio como "força" ou "hipertrofia".

Campo "focus" de cada dia: só os grupos musculares que se treinam nesse dia, por palavras simples e do dia a dia, ligados por "e". Escreve "Pernas, peito e costas" ou "Ombros e braços". Nunca uses nomes de movimentos nem termos técnicos: nada de "dobra de anca", "empurrar horizontal", "cadeia posterior" ou "unilateral". No máximo quatro palavras.

Campo "rationale": duas ou três frases a explicar porque é que este plano serve a estes dois. Fala com eles por tu, em linguagem do dia a dia, como se explicasses a um amigo que nunca pôs os pés num ginásio. Não menciones que foi gerado automaticamente.

Catálogo:
${catalogue}`;
}

/* -------------------------------------------------------------- validation */

export type ValidationResult =
  | { ok: true; plan: GeneratedPlan }
  | { ok: false; errors: string[] };

export function validateGeneratedPlan(
  candidate: unknown,
  context: {
    expectedDays: number;
    catalogue: CatalogueEntry[];
    sessionMinutes?: number;
  },
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

    if (typeof day?.focus !== "string" || day.focus.trim().length === 0) {
      errors.push(`${where}: missing focus`);
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
      } else {
        // The goal is muscle and a habit, so a strength block is the wrong
        // answer however well formed it is. Unilateral work is logged as the
        // total across both sides, so it is halved before comparing.
        const range = repRangeFor(entry);
        const divisor = entry.perSide && !entry.isTimed ? 2 : 1;
        const low = item.rep_low / divisor;
        const high = item.rep_high / divisor;

        if (low < range.low || high > range.high) {
          errors.push(
            `${at}: ${item.rep_low}–${item.rep_high} is outside the ${range.low}–${range.high} wanted for ${entry.family}${entry.perSide ? " (per side)" : ""}`,
          );
        }
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

    // They set aside an hour and expect to use it. Running over is fine; a day
    // that would be over in forty minutes is not what was asked for.
    if (context.sessionMinutes && errors.length === 0) {
      const shape = day.items.map((item) => {
        const entry = bySlug.get(item.exercise);
        return {
          sets: item.sets,
          repLow: item.rep_low,
          repHigh: item.rep_high,
          restSec: item.rest_sec,
          isTimed: entry?.isTimed,
          family: entry?.family,
        };
      });

      if (!fitsSession(shape, context.sessionMinutes)) {
        errors.push(
          `${where}: about ${estimateMinutes(shape)} min, short of the ${context.sessionMinutes} min asked for`,
        );
      }
    }
  });

  for (const [muscle, sets] of weeklySetsPerMuscle) {
    if (sets > LIMITS.maxWeeklySetsPerMuscle) {
      errors.push(`${muscle}: ${sets} weekly sets exceeds the safe limit`);
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, plan: plan as GeneratedPlan };
}
