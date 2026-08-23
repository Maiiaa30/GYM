/**
 * Programas de treino integrados.
 *
 * São o ponto de partida e a alternativa segura: treinos de corpo inteiro
 * construídos à volta de poucos exercícios compostos, nas gamas de repetições
 * em que um principiante progride. Os programas gerados substituem os dias,
 * nunca as regras de progressão.
 */

import type { EquipmentProfile } from "@/lib/database.types";

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

const HOLD = "Aguenta o número de segundos indicado.";

const FULL_GYM: TemplateDay[] = [
  {
    name: "Dia A",
    focus: "Agachamento e supino",
    items: [
      { exercise: "barbell-squat", sets: 3, repLow: 5, repHigh: 5, restSec: 180 },
      { exercise: "barbell-bench-press", sets: 3, repLow: 5, repHigh: 5, restSec: 180 },
      { exercise: "barbell-row", sets: 3, repLow: 8, repHigh: 8, restSec: 120 },
      { exercise: "face-pull", sets: 2, repLow: 12, repHigh: 15, restSec: 60 },
      { exercise: "plank", sets: 3, repLow: 30, repHigh: 45, restSec: 60, notes: HOLD },
    ],
  },
  {
    name: "Dia B",
    focus: "Dobra de anca e ombros",
    items: [
      { exercise: "romanian-deadlift", sets: 3, repLow: 8, repHigh: 8, restSec: 150 },
      { exercise: "overhead-press", sets: 3, repLow: 5, repHigh: 5, restSec: 180 },
      { exercise: "lat-pulldown", sets: 3, repLow: 8, repHigh: 10, restSec: 120 },
      { exercise: "leg-press", sets: 3, repLow: 10, repHigh: 12, restSec: 120 },
      { exercise: "cable-crunch", sets: 3, repLow: 12, repHigh: 15, restSec: 60 },
    ],
  },
  {
    name: "Dia C",
    focus: "Puxadas e tronco",
    items: [
      { exercise: "barbell-deadlift", sets: 2, repLow: 5, repHigh: 5, restSec: 210 },
      { exercise: "incline-bench-press", sets: 3, repLow: 8, repHigh: 8, restSec: 150 },
      { exercise: "seated-cable-row", sets: 3, repLow: 10, repHigh: 12, restSec: 120 },
      { exercise: "dumbbell-curl", sets: 2, repLow: 10, repHigh: 12, restSec: 60 },
      { exercise: "triceps-pushdown", sets: 2, repLow: 10, repHigh: 12, restSec: 60 },
    ],
  },
  {
    name: "Dia D",
    focus: "Agachamento frontal e peito",
    items: [
      { exercise: "front-squat", sets: 3, repLow: 5, repHigh: 5, restSec: 180 },
      { exercise: "dumbbell-bench-press", sets: 3, repLow: 8, repHigh: 10, restSec: 120 },
      { exercise: "chin-up", sets: 3, repLow: 3, repHigh: 8, restSec: 120 },
      { exercise: "lateral-raise", sets: 3, repLow: 12, repHigh: 15, restSec: 60 },
      { exercise: "calf-raise", sets: 3, repLow: 10, repHigh: 12, restSec: 60 },
    ],
  },
  {
    name: "Dia E",
    focus: "Ancas e ombros",
    items: [
      { exercise: "barbell-hip-thrust", sets: 3, repLow: 8, repHigh: 10, restSec: 120 },
      { exercise: "dumbbell-shoulder-press", sets: 3, repLow: 8, repHigh: 10, restSec: 120 },
      { exercise: "dumbbell-row", sets: 3, repLow: 10, repHigh: 12, restSec: 90 },
      { exercise: "split-squat", sets: 3, repLow: 8, repHigh: 10, restSec: 90, notes: "Repetições por perna." },
      { exercise: "side-plank", sets: 2, repLow: 30, repHigh: 40, restSec: 45, notes: HOLD },
    ],
  },
];

const HOTEL: TemplateDay[] = [
  {
    name: "Dia A",
    focus: "Empurrar e pernas",
    items: [
      { exercise: "push-up", sets: 4, repLow: 8, repHigh: 15, restSec: 90 },
      { exercise: "bodyweight-squat", sets: 4, repLow: 15, repHigh: 20, restSec: 90 },
      { exercise: "inverted-row", sets: 3, repLow: 8, repHigh: 12, restSec: 90 },
      { exercise: "glute-bridge", sets: 3, repLow: 15, repHigh: 20, restSec: 60 },
      { exercise: "plank", sets: 3, repLow: 30, repHigh: 45, restSec: 60, notes: HOLD },
    ],
  },
  {
    name: "Dia B",
    focus: "Ombros e unilateral",
    items: [
      { exercise: "pike-push-up", sets: 4, repLow: 6, repHigh: 12, restSec: 90 },
      { exercise: "walking-lunge", sets: 3, repLow: 10, repHigh: 12, restSec: 90, notes: "Repetições por perna." },
      { exercise: "inverted-row", sets: 3, repLow: 8, repHigh: 12, restSec: 90 },
      { exercise: "mountain-climber", sets: 3, repLow: 20, repHigh: 30, restSec: 60 },
      { exercise: "side-plank", sets: 2, repLow: 30, repHigh: 40, restSec: 45, notes: HOLD },
    ],
  },
  {
    name: "Dia C",
    focus: "Corpo inteiro",
    items: [
      { exercise: "push-up", sets: 4, repLow: 10, repHigh: 20, restSec: 90 },
      { exercise: "bodyweight-squat", sets: 4, repLow: 20, repHigh: 25, restSec: 90 },
      { exercise: "superman", sets: 3, repLow: 15, repHigh: 20, restSec: 60 },
      { exercise: "glute-bridge", sets: 3, repLow: 20, repHigh: 25, restSec: 60 },
      { exercise: "plank", sets: 3, repLow: 40, repHigh: 60, restSec: 60, notes: HOLD },
    ],
  },
];

const HOME_MINIMAL: TemplateDay[] = [
  {
    name: "Dia A",
    focus: "Agachamento e supino",
    items: [
      { exercise: "goblet-squat", sets: 3, repLow: 10, repHigh: 12, restSec: 120 },
      { exercise: "dumbbell-bench-press", sets: 3, repLow: 8, repHigh: 12, restSec: 120 },
      { exercise: "dumbbell-row", sets: 3, repLow: 10, repHigh: 12, restSec: 90 },
      { exercise: "plank", sets: 3, repLow: 30, repHigh: 45, restSec: 60, notes: HOLD },
    ],
  },
  {
    name: "Dia B",
    focus: "Afundos e ombros",
    items: [
      { exercise: "dumbbell-lunge", sets: 3, repLow: 10, repHigh: 12, restSec: 120, notes: "Repetições por perna." },
      { exercise: "dumbbell-shoulder-press", sets: 3, repLow: 8, repHigh: 12, restSec: 120 },
      { exercise: "dumbbell-curl", sets: 3, repLow: 10, repHigh: 12, restSec: 60 },
      { exercise: "glute-bridge", sets: 3, repLow: 15, repHigh: 20, restSec: 60 },
    ],
  },
  {
    name: "Dia C",
    focus: "Unilateral e empurrar",
    items: [
      { exercise: "split-squat", sets: 3, repLow: 8, repHigh: 12, restSec: 120, notes: "Repetições por perna." },
      { exercise: "push-up", sets: 3, repLow: 10, repHigh: 15, restSec: 90 },
      { exercise: "dumbbell-row", sets: 3, repLow: 10, repHigh: 12, restSec: 90 },
      { exercise: "side-plank", sets: 2, repLow: 30, repHigh: 40, restSec: 45, notes: HOLD },
    ],
  },
];

const TEMPLATES: Record<EquipmentProfile, TemplateDay[]> = {
  full_gym: FULL_GYM,
  hotel: HOTEL,
  home_minimal: HOME_MINIMAL,
};

/**
 * The days for one training block. Rotation is by session count, so a member
 * training three days a week works through A, B, C and starts again.
 */
export function templateDays(
  profile: EquipmentProfile,
  daysPerWeek: number,
): TemplateDay[] {
  const days = TEMPLATES[profile];
  const count = Math.min(Math.max(daysPerWeek, 1), days.length);
  return days.slice(0, count);
}

export function templateName(profile: EquipmentProfile): string {
  switch (profile) {
    case "hotel":
      return "Bloco de viagem";
    case "home_minimal":
      return "Bloco em casa";
    default:
      return "Bloco de base";
  }
}

export function templateRationale(
  profile: EquipmentProfile,
  daysPerWeek: number,
): string {
  const days = templateDays(profile, daysPerWeek).length;
  if (profile === "hotel") {
    return `${days} treinos com o peso do corpo para manteres o que já ganhaste enquanto estás fora do ginásio. As cargas ficam onde estão, não sobem.`;
  }
  if (profile === "home_minimal") {
    return `${days} treinos com halteres para o corpo inteiro, com mais repetições para compensar as cargas mais leves.`;
  }
  return `${days} treinos de corpo inteiro assentes no agachamento, na dobra de anca, num empurrar e num puxar. Acrescenta um pouco de peso sempre que fizeres todas as repetições.`;
}
