/**
 * Programas de treino integrados.
 *
 * São o ponto de partida e a alternativa segura: treinos de corpo inteiro
 * construídos à volta de poucos exercícios compostos, nas gamas de repetições
 * em que um principiante progride. Os programas gerados substituem os dias,
 * nunca as regras de progressão.
 *
 * Cada dia é montado para encher a hora que está definida nas definições: com
 * descansos a sério entre séries pesadas, quatro ou cinco exercícios não
 * chegam lá. O nome do dia vem do dia da semana em que cai, e o `focus` diz os
 * grupos musculares por palavras simples — "Pernas e peito", não "Dobra de
 * anca".
 */

import type { EquipmentProfile } from "@/lib/database.types";
import { trainingDayNames } from "./schedule.ts";

export type TemplateItem = {
  exercise: string;
  sets: number;
  repLow: number;
  repHigh: number;
  restSec: number;
  notes?: string;
};

export type TemplateDay = {
  name: string;
  focus: string;
  items: TemplateItem[];
};

/** Um dia antes de saber em que dia da semana cai. */
type TemplateShape = Omit<TemplateDay, "name">;

const HOLD = "Aguenta o número de segundos indicado.";

const FULL_GYM: TemplateShape[] = [
  {
    focus: "Pernas, peito e costas",
    items: [
      { exercise: "barbell-squat", sets: 3, repLow: 10, repHigh: 12, restSec: 180 },
      { exercise: "barbell-bench-press", sets: 3, repLow: 10, repHigh: 12, restSec: 180 },
      { exercise: "barbell-row", sets: 3, repLow: 10, repHigh: 12, restSec: 120 },
      { exercise: "leg-press", sets: 3, repLow: 10, repHigh: 12, restSec: 90 },
      { exercise: "face-pull", sets: 3, repLow: 12, repHigh: 15, restSec: 60 },
      { exercise: "plank", sets: 3, repLow: 30, repHigh: 45, restSec: 60, notes: HOLD },
    ],
  },
  {
    focus: "Pernas, ombros e costas",
    items: [
      { exercise: "romanian-deadlift", sets: 3, repLow: 10, repHigh: 12, restSec: 150 },
      { exercise: "overhead-press", sets: 3, repLow: 10, repHigh: 12, restSec: 180 },
      { exercise: "lat-pulldown", sets: 3, repLow: 10, repHigh: 12, restSec: 120 },
      { exercise: "leg-press", sets: 3, repLow: 10, repHigh: 12, restSec: 120 },
      { exercise: "lateral-raise", sets: 3, repLow: 12, repHigh: 15, restSec: 60 },
      { exercise: "cable-crunch", sets: 3, repLow: 12, repHigh: 15, restSec: 60 },
    ],
  },
  {
    focus: "Costas, peito e braços",
    items: [
      { exercise: "barbell-deadlift", sets: 3, repLow: 10, repHigh: 12, restSec: 210 },
      { exercise: "incline-bench-press", sets: 3, repLow: 10, repHigh: 12, restSec: 150 },
      { exercise: "seated-cable-row", sets: 3, repLow: 10, repHigh: 12, restSec: 120 },
      { exercise: "face-pull", sets: 3, repLow: 12, repHigh: 15, restSec: 60 },
      { exercise: "dumbbell-curl", sets: 3, repLow: 10, repHigh: 12, restSec: 60 },
      { exercise: "triceps-pushdown", sets: 3, repLow: 10, repHigh: 12, restSec: 60 },
    ],
  },
  {
    focus: "Pernas, peito e ombros",
    items: [
      { exercise: "front-squat", sets: 3, repLow: 10, repHigh: 12, restSec: 180 },
      { exercise: "dumbbell-bench-press", sets: 3, repLow: 10, repHigh: 12, restSec: 120 },
      { exercise: "chin-up", sets: 3, repLow: 6, repHigh: 10, restSec: 120 },
      { exercise: "dumbbell-shoulder-press", sets: 3, repLow: 10, repHigh: 12, restSec: 120 },
      { exercise: "lateral-raise", sets: 3, repLow: 12, repHigh: 15, restSec: 60 },
      { exercise: "calf-raise", sets: 4, repLow: 10, repHigh: 12, restSec: 60 },
    ],
  },
  {
    focus: "Glúteos, ombros e costas",
    items: [
      { exercise: "barbell-hip-thrust", sets: 3, repLow: 10, repHigh: 12, restSec: 120 },
      { exercise: "dumbbell-shoulder-press", sets: 3, repLow: 10, repHigh: 12, restSec: 120 },
      { exercise: "dumbbell-row", sets: 3, repLow: 20, repHigh: 24, restSec: 90 },
      { exercise: "split-squat", sets: 4, repLow: 20, repHigh: 24, restSec: 90 },
      { exercise: "lying-leg-curl", sets: 4, repLow: 10, repHigh: 12, restSec: 60 },
      { exercise: "side-plank", sets: 3, repLow: 30, repHigh: 40, restSec: 45, notes: HOLD },
    ],
  },
];

const HOTEL: TemplateShape[] = [
  {
    focus: "Peito, pernas e costas",
    items: [
      { exercise: "push-up", sets: 5, repLow: 10, repHigh: 15, restSec: 90 },
      { exercise: "bodyweight-squat", sets: 5, repLow: 15, repHigh: 20, restSec: 90 },
      { exercise: "inverted-row", sets: 4, repLow: 10, repHigh: 14, restSec: 90 },
      { exercise: "walking-lunge", sets: 3, repLow: 20, repHigh: 24, restSec: 90 },
      { exercise: "glute-bridge", sets: 3, repLow: 15, repHigh: 20, restSec: 60 },
      { exercise: "pike-push-up", sets: 3, repLow: 8, repHigh: 12, restSec: 75 },
      { exercise: "plank", sets: 3, repLow: 30, repHigh: 45, restSec: 60, notes: HOLD },
    ],
  },
  {
    focus: "Ombros, pernas e costas",
    items: [
      { exercise: "pike-push-up", sets: 4, repLow: 8, repHigh: 12, restSec: 90 },
      { exercise: "walking-lunge", sets: 4, repLow: 20, repHigh: 24, restSec: 90 },
      { exercise: "inverted-row", sets: 4, repLow: 10, repHigh: 14, restSec: 90 },
      { exercise: "push-up", sets: 4, repLow: 10, repHigh: 20, restSec: 75 },
      { exercise: "glute-bridge", sets: 3, repLow: 20, repHigh: 25, restSec: 60 },
      { exercise: "mountain-climber", sets: 3, repLow: 20, repHigh: 30, restSec: 60 },
      { exercise: "side-plank", sets: 3, repLow: 30, repHigh: 40, restSec: 45, notes: HOLD },
    ],
  },
  {
    focus: "Corpo inteiro",
    items: [
      { exercise: "push-up", sets: 4, repLow: 10, repHigh: 20, restSec: 90 },
      { exercise: "bodyweight-squat", sets: 5, repLow: 20, repHigh: 25, restSec: 90 },
      { exercise: "inverted-row", sets: 4, repLow: 10, repHigh: 14, restSec: 90 },
      { exercise: "walking-lunge", sets: 3, repLow: 20, repHigh: 24, restSec: 90 },
      { exercise: "glute-bridge", sets: 3, repLow: 20, repHigh: 25, restSec: 60 },
      { exercise: "superman", sets: 3, repLow: 30, repHigh: 45, restSec: 60, notes: HOLD },
      { exercise: "plank", sets: 3, repLow: 40, repHigh: 60, restSec: 60, notes: HOLD },
    ],
  },
];

const HOME_MINIMAL: TemplateShape[] = [
  {
    focus: "Pernas, peito e costas",
    items: [
      { exercise: "goblet-squat", sets: 4, repLow: 10, repHigh: 12, restSec: 120 },
      { exercise: "dumbbell-bench-press", sets: 4, repLow: 10, repHigh: 12, restSec: 120 },
      { exercise: "dumbbell-row", sets: 4, repLow: 20, repHigh: 24, restSec: 90 },
      { exercise: "dumbbell-lunge", sets: 3, repLow: 20, repHigh: 24, restSec: 90 },
      { exercise: "dumbbell-curl", sets: 3, repLow: 10, repHigh: 12, restSec: 60 },
      { exercise: "plank", sets: 3, repLow: 30, repHigh: 45, restSec: 60, notes: HOLD },
    ],
  },
  {
    focus: "Pernas, ombros e braços",
    items: [
      { exercise: "dumbbell-lunge", sets: 4, repLow: 20, repHigh: 24, restSec: 120 },
      { exercise: "dumbbell-shoulder-press", sets: 4, repLow: 10, repHigh: 12, restSec: 120 },
      { exercise: "dumbbell-row", sets: 3, repLow: 20, repHigh: 24, restSec: 90 },
      { exercise: "dumbbell-curl", sets: 3, repLow: 10, repHigh: 12, restSec: 60 },
      { exercise: "overhead-triceps-extension", sets: 3, repLow: 20, repHigh: 24, restSec: 60 },
      { exercise: "glute-bridge", sets: 3, repLow: 15, repHigh: 20, restSec: 60 },
    ],
  },
  {
    focus: "Pernas e tronco",
    items: [
      { exercise: "split-squat", sets: 4, repLow: 20, repHigh: 24, restSec: 120 },
      { exercise: "push-up", sets: 4, repLow: 10, repHigh: 15, restSec: 90 },
      { exercise: "dumbbell-row", sets: 4, repLow: 20, repHigh: 24, restSec: 90 },
      { exercise: "goblet-squat", sets: 3, repLow: 12, repHigh: 15, restSec: 90 },
      { exercise: "hammer-curl", sets: 3, repLow: 10, repHigh: 12, restSec: 60 },
      { exercise: "side-plank", sets: 3, repLow: 30, repHigh: 40, restSec: 45, notes: HOLD },
    ],
  },
];

const TEMPLATES: Record<EquipmentProfile, TemplateShape[]> = {
  full_gym: FULL_GYM,
  hotel: HOTEL,
  home_minimal: HOME_MINIMAL,
};

/**
 * The days for one training block, each named after the weekday it falls on.
 * A member training three days a week gets Monday, Wednesday and Friday.
 */
export function templateDays(
  profile: EquipmentProfile,
  daysPerWeek: number,
): TemplateDay[] {
  const shapes = TEMPLATES[profile];
  const count = Math.min(Math.max(daysPerWeek, 1), shapes.length);
  const names = trainingDayNames(count);

  return shapes.slice(0, count).map((shape, index) => ({
    name: names[index],
    focus: shape.focus,
    items: shape.items,
  }));
}

export function templateName(profile: EquipmentProfile): string {
  switch (profile) {
    case "hotel":
      return "Plano de viagem";
    case "home_minimal":
      return "Plano de casa";
    default:
      return "Plano de base";
  }
}

export function templateRationale(
  profile: EquipmentProfile,
  daysPerWeek: number,
): string {
  const days = templateDays(profile, daysPerWeek).length;
  if (profile === "hotel") {
    return `${days} treinos só com o peso do corpo, para não perderes o que já ganhaste enquanto estás fora do ginásio. As cargas ficam onde estão, não sobem.`;
  }
  if (profile === "home_minimal") {
    return `${days} treinos de corpo inteiro com halteres. Levam mais repetições do que no ginásio, para compensar os pesos serem mais leves.`;
  }
  return `${days} treinos de corpo inteiro à volta de um agachamento, um empurrar e um puxar. As séries são de 8 a 12 repetições, que é onde se ganha músculo sem andar a levantar pesos que ainda não controlas. Sempre que fizeres todas as repetições, o peso sobe um bocadinho no treino seguinte.`;
}
