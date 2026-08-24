import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildPrompt,
  planResponseSchema,
  validateGeneratedPlan,
  type CatalogueEntry,
} from "./plan-generation.ts";

const catalogue: CatalogueEntry[] = [
  {
    slug: "barbell-squat",
    name: "Barbell Back Squat",
    primary_muscle: "quadriceps",
    equipment: "barbell",
    family: "lower_compound",
  },
  {
    slug: "push-up",
    name: "Push-Up",
    primary_muscle: "chest",
    equipment: "body only",
    family: "bodyweight",
  },
  {
    slug: "plank",
    name: "Plank",
    primary_muscle: "abdominals",
    equipment: "body only",
    family: "bodyweight",
    isTimed: true,
  },
];

const validDay = {
  focus: "Pernas, peito e costas",
  items: [
    { exercise: "barbell-squat", sets: 3, rep_low: 10, rep_high: 12, rest_sec: 180 },
    { exercise: "push-up", sets: 3, rep_low: 8, rep_high: 12, rest_sec: 90 },
    { exercise: "plank", sets: 3, rep_low: 30, rep_high: 45, rest_sec: 60 },
  ],
};

const valid = { name: "Block", rationale: "Because.", days: [validDay] };

test("a well-formed plan passes", () => {
  const result = validateGeneratedPlan(valid, { expectedDays: 1, catalogue });
  assert.equal(result.ok, true);
});

test("sets under ten repetitions are rejected on loaded work", () => {
  // Three sets of five is the shape the old prompt produced, and eight is
  // still below the floor they asked for. Both are valid programmes; neither
  // is the one these two want.
  const result = validateGeneratedPlan(
    {
      ...valid,
      days: [
        {
          ...validDay,
          items: [
            { exercise: "barbell-squat", sets: 3, rep_low: 5, rep_high: 5, rest_sec: 180 },
            ...validDay.items.slice(1),
          ],
        },
      ],
    },
    { expectedDays: 1, catalogue },
  );

  assert.equal(result.ok, false);
  assert.ok(
    !result.ok && result.errors.some((error) => error.includes("outside the 10")),
    `expected the repetition range to be the complaint, got ${!result.ok ? result.errors : ""}`,
  );
});

test("a day without a focus is rejected", () => {
  const result = validateGeneratedPlan(
    { ...valid, days: [{ ...validDay, focus: "  " }] },
    { expectedDays: 1, catalogue },
  );
  assert.equal(result.ok, false);
});

test("a day shorter than the session they set aside is rejected", () => {
  // The valid day is around half an hour, which is what they asked for here
  // and half of what they asked for below.
  const short = validateGeneratedPlan(valid, {
    expectedDays: 1,
    catalogue,
    sessionMinutes: 60,
  });
  assert.equal(short.ok, false);
  assert.ok(
    !short.ok && short.errors.some((error) => error.includes("short of")),
    "expected the duration to be the complaint",
  );

  const enough = validateGeneratedPlan(valid, {
    expectedDays: 1,
    catalogue,
    sessionMinutes: 25,
  });
  assert.equal(enough.ok, true);
});

test("a long day is never rejected for running over", () => {
  const long = {
    ...valid,
    days: [
      {
        ...validDay,
        items: validDay.items.map((item) => ({ ...item, sets: 6 })),
      },
    ],
  };
  const result = validateGeneratedPlan(long, {
    expectedDays: 1,
    catalogue,
    sessionMinutes: 30,
  });
  assert.equal(result.ok, true);
});

test("an unknown exercise is rejected", () => {
  const result = validateGeneratedPlan(
    {
      ...valid,
      days: [
        {
          ...validDay,
          items: [...validDay.items, { exercise: "moon-press", sets: 3, rep_low: 10, rep_high: 12, rest_sec: 90 }],
        },
      ],
    },
    { expectedDays: 1, catalogue },
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.errors.join(), /unknown exercise/);
});

test("the wrong number of days is rejected", () => {
  const result = validateGeneratedPlan(valid, { expectedDays: 3, catalogue });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.errors.join(), /expected 3 days/);
});

test("a repeated exercise on one day is rejected", () => {
  const result = validateGeneratedPlan(
    {
      ...valid,
      days: [{ ...validDay, items: [...validDay.items, validDay.items[0]] }],
    },
    { expectedDays: 1, catalogue },
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.errors.join(), /appears twice/);
});

test("absurd set counts are rejected", () => {
  const result = validateGeneratedPlan(
    {
      ...valid,
      days: [
        {
          ...validDay,
          items: [{ ...validDay.items[0], sets: 40 }, validDay.items[1], validDay.items[2]],
        },
      ],
    },
    { expectedDays: 1, catalogue },
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.errors.join(), /sets is out of range/);
});

test("excessive weekly volume for one muscle is rejected", () => {
  const heavy = {
    ...valid,
    days: [
      { ...validDay, items: validDay.items.map((item) => ({ ...item, sets: 6 })) },
      { ...validDay, name: "Day B", items: validDay.items.map((item) => ({ ...item, sets: 6 })) },
      { ...validDay, name: "Day C", items: validDay.items.map((item) => ({ ...item, sets: 6 })) },
      { ...validDay, name: "Day D", items: validDay.items.map((item) => ({ ...item, sets: 6 })) },
      { ...validDay, name: "Day E", items: validDay.items.map((item) => ({ ...item, sets: 6 })) },
    ],
  };
  const result = validateGeneratedPlan(heavy, { expectedDays: 5, catalogue });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.errors.join(), /exceeds the safe limit/);
});

test("a reversed repetition range is rejected", () => {
  const result = validateGeneratedPlan(
    {
      ...valid,
      days: [
        {
          ...validDay,
          items: [{ ...validDay.items[0], rep_low: 12, rep_high: 5 }, validDay.items[1], validDay.items[2]],
        },
      ],
    },
    { expectedDays: 1, catalogue },
  );
  assert.equal(result.ok, false);
});

test("rubbish input is rejected without throwing", () => {
  assert.equal(validateGeneratedPlan(null, { expectedDays: 1, catalogue }).ok, false);
  assert.equal(validateGeneratedPlan("nope", { expectedDays: 1, catalogue }).ok, false);
  assert.equal(validateGeneratedPlan({}, { expectedDays: 1, catalogue }).ok, false);
});

test("the response schema only offers the allowed exercises", () => {
  const schema = planResponseSchema(["barbell-squat", "plank"]) as {
    properties: {
      days: {
        items: {
          properties: {
            items: { items: { properties: { exercise: { enum: string[] } } } };
          };
        };
      };
    };
  };
  assert.deepEqual(
    schema.properties.days.items.properties.items.items.properties.exercise.enum,
    ["barbell-squat", "plank"],
  );
});

test("the prompt carries the constraints and the catalogue", () => {
  const prompt = buildPrompt({
    members: [
      {
        name: "One",
        heightCm: 180,
        bodyWeightKg: 75,
        age: 22,
        sex: "male",
        experience: "beginner",
        injuryNotes: "sore left knee",
        weightGoalKg: 82,
        lifts: [{ exercise: "barbell-squat", workingKg: 60, failCount: 1 }],
      },
    ],
    daysPerWeek: 3,
    sessionMinutes: 60,
    equipment: "full_gym",
    catalogue,
    previousBlock: null,
  });

  assert.match(prompt, /exatamente 3 dias de treino distintos/);
  assert.match(prompt, /barbell-squat/);
  assert.match(prompt, /sore left knee/);
  assert.match(prompt, /60 kg \(estagnado\)/);
  assert.match(prompt, /Não prescrevas cargas/);
  assert.match(prompt, /português europeu/);
});

test("the previous plan's exercises are sent so the next one differs", () => {
  const prompt = buildPrompt({
    members: [
      {
        name: "One", heightCm: 180, bodyWeightKg: 62, age: 22, sex: "male",
        experience: "beginner", injuryNotes: null, weightGoalKg: 70, lifts: [],
      },
    ],
    daysPerWeek: 3,
    sessionMinutes: 60,
    equipment: "full_gym",
    catalogue,
    previousBlock: {
      name: "Anterior",
      completedSessions: 9,
      stalledLifts: ["barbell-squat"],
      exercises: ["barbell-squat", "push-up"],
    },
  });

  assert.match(prompt, /já andaram a fazer: barbell-squat, push-up/);
  assert.match(prompt, /Estagnados em: barbell-squat/);
  // The goal, not a coach persona, and the floor they asked for.
  assert.match(prompt, /magros/);
  assert.match(prompt, /menos de 10 repetições/);
  assert.doesNotMatch(prompt, /treinador de força/);
  assert.match(prompt, /quer chegar aos 70 kg/);
});
