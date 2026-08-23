/**
 * Built-in training templates.
 *
 * These are the fallback and the starting point: full-body sessions built
 * around a small number of compound movements, in the rep ranges a beginner
 * makes progress on. The generated programmes replace the day definitions but
 * never the progression rules.
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

const HOLD = "Hold for the number of seconds shown.";

const FULL_GYM: TemplateDay[] = [
  {
    name: "Day A",
    focus: "Squat and press",
    items: [
      { exercise: "barbell-squat", sets: 3, repLow: 5, repHigh: 5, restSec: 180 },
      { exercise: "barbell-bench-press", sets: 3, repLow: 5, repHigh: 5, restSec: 180 },
      { exercise: "barbell-row", sets: 3, repLow: 8, repHigh: 8, restSec: 120 },
      { exercise: "face-pull", sets: 2, repLow: 12, repHigh: 15, restSec: 60 },
      { exercise: "plank", sets: 3, repLow: 30, repHigh: 45, restSec: 60, notes: HOLD },
    ],
  },
  {
    name: "Day B",
    focus: "Hinge and overhead",
    items: [
      { exercise: "romanian-deadlift", sets: 3, repLow: 8, repHigh: 8, restSec: 150 },
      { exercise: "overhead-press", sets: 3, repLow: 5, repHigh: 5, restSec: 180 },
      { exercise: "lat-pulldown", sets: 3, repLow: 8, repHigh: 10, restSec: 120 },
      { exercise: "leg-press", sets: 3, repLow: 10, repHigh: 12, restSec: 120 },
      { exercise: "cable-crunch", sets: 3, repLow: 12, repHigh: 15, restSec: 60 },
    ],
  },
  {
    name: "Day C",
    focus: "Pull and upper body",
    items: [
      { exercise: "barbell-deadlift", sets: 2, repLow: 5, repHigh: 5, restSec: 210 },
      { exercise: "incline-bench-press", sets: 3, repLow: 8, repHigh: 8, restSec: 150 },
      { exercise: "seated-cable-row", sets: 3, repLow: 10, repHigh: 12, restSec: 120 },
      { exercise: "dumbbell-curl", sets: 2, repLow: 10, repHigh: 12, restSec: 60 },
      { exercise: "triceps-pushdown", sets: 2, repLow: 10, repHigh: 12, restSec: 60 },
    ],
  },
  {
    name: "Day D",
    focus: "Front squat and chest",
    items: [
      { exercise: "front-squat", sets: 3, repLow: 5, repHigh: 5, restSec: 180 },
      { exercise: "dumbbell-bench-press", sets: 3, repLow: 8, repHigh: 10, restSec: 120 },
      { exercise: "chin-up", sets: 3, repLow: 3, repHigh: 8, restSec: 120 },
      { exercise: "lateral-raise", sets: 3, repLow: 12, repHigh: 15, restSec: 60 },
      { exercise: "calf-raise", sets: 3, repLow: 10, repHigh: 12, restSec: 60 },
    ],
  },
  {
    name: "Day E",
    focus: "Hips and shoulders",
    items: [
      { exercise: "barbell-hip-thrust", sets: 3, repLow: 8, repHigh: 10, restSec: 120 },
      { exercise: "dumbbell-shoulder-press", sets: 3, repLow: 8, repHigh: 10, restSec: 120 },
      { exercise: "dumbbell-row", sets: 3, repLow: 10, repHigh: 12, restSec: 90 },
      { exercise: "split-squat", sets: 3, repLow: 8, repHigh: 10, restSec: 90, notes: "Repetitions per leg." },
      { exercise: "side-plank", sets: 2, repLow: 30, repHigh: 40, restSec: 45, notes: HOLD },
    ],
  },
];

const HOTEL: TemplateDay[] = [
  {
    name: "Day A",
    focus: "Push and legs",
    items: [
      { exercise: "push-up", sets: 4, repLow: 8, repHigh: 15, restSec: 90 },
      { exercise: "bodyweight-squat", sets: 4, repLow: 15, repHigh: 20, restSec: 90 },
      { exercise: "inverted-row", sets: 3, repLow: 8, repHigh: 12, restSec: 90 },
      { exercise: "glute-bridge", sets: 3, repLow: 15, repHigh: 20, restSec: 60 },
      { exercise: "plank", sets: 3, repLow: 30, repHigh: 45, restSec: 60, notes: HOLD },
    ],
  },
  {
    name: "Day B",
    focus: "Shoulders and single leg",
    items: [
      { exercise: "pike-push-up", sets: 4, repLow: 6, repHigh: 12, restSec: 90 },
      { exercise: "walking-lunge", sets: 3, repLow: 10, repHigh: 12, restSec: 90, notes: "Repetitions per leg." },
      { exercise: "inverted-row", sets: 3, repLow: 8, repHigh: 12, restSec: 90 },
      { exercise: "mountain-climber", sets: 3, repLow: 20, repHigh: 30, restSec: 60 },
      { exercise: "side-plank", sets: 2, repLow: 30, repHigh: 40, restSec: 45, notes: HOLD },
    ],
  },
  {
    name: "Day C",
    focus: "Full body",
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
    name: "Day A",
    focus: "Squat and press",
    items: [
      { exercise: "goblet-squat", sets: 3, repLow: 10, repHigh: 12, restSec: 120 },
      { exercise: "dumbbell-bench-press", sets: 3, repLow: 8, repHigh: 12, restSec: 120 },
      { exercise: "dumbbell-row", sets: 3, repLow: 10, repHigh: 12, restSec: 90 },
      { exercise: "plank", sets: 3, repLow: 30, repHigh: 45, restSec: 60, notes: HOLD },
    ],
  },
  {
    name: "Day B",
    focus: "Lunge and overhead",
    items: [
      { exercise: "dumbbell-lunge", sets: 3, repLow: 10, repHigh: 12, restSec: 120, notes: "Repetitions per leg." },
      { exercise: "dumbbell-shoulder-press", sets: 3, repLow: 8, repHigh: 12, restSec: 120 },
      { exercise: "dumbbell-curl", sets: 3, repLow: 10, repHigh: 12, restSec: 60 },
      { exercise: "glute-bridge", sets: 3, repLow: 15, repHigh: 20, restSec: 60 },
    ],
  },
  {
    name: "Day C",
    focus: "Single leg and push",
    items: [
      { exercise: "split-squat", sets: 3, repLow: 8, repHigh: 12, restSec: 120, notes: "Repetitions per leg." },
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
      return "Travelling block";
    case "home_minimal":
      return "Home block";
    default:
      return "Foundation block";
  }
}

export function templateRationale(
  profile: EquipmentProfile,
  daysPerWeek: number,
): string {
  const days = templateDays(profile, daysPerWeek).length;
  if (profile === "hotel") {
    return `${days} bodyweight sessions to maintain what you have built while away from the gym. Loads are held, not increased.`;
  }
  if (profile === "home_minimal") {
    return `${days} dumbbell sessions covering the whole body, in higher repetition ranges to make up for the lighter loads.`;
  }
  return `${days} full-body sessions built on the squat, the hinge, a press and a pull. Add a small amount of weight whenever every repetition is completed.`;
}
