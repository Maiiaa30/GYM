import assert from "node:assert/strict";
import { test } from "node:test";
import { pickAlternative, swapDay, type SwapCandidate } from "./swap.ts";

const catalogue: SwapCandidate[] = [
  { slug: "barbell-bench-press", muscle: "peito", family: "upper_compound" },
  { slug: "dumbbell-bench-press", muscle: "peito", family: "upper_compound" },
  { slug: "chest-press-machine", muscle: "peito", family: "upper_compound" },
  { slug: "push-up", muscle: "peito", family: "bodyweight" },
  { slug: "barbell-squat", muscle: "quadríceps", family: "lower_compound" },
  { slug: "leg-press", muscle: "quadríceps", family: "lower_compound" },
  { slug: "leg-extension", muscle: "quadríceps", family: "accessory" },
  { slug: "lateral-raise", muscle: "ombros", family: "accessory" },
];

const find = (slug: string) => catalogue.find((entry) => entry.slug === slug)!;

test("a replacement works the same muscle", () => {
  const alternative = pickAlternative({
    current: find("barbell-bench-press"),
    catalogue,
    exclude: [],
  });
  assert.equal(alternative?.muscle, "peito");
  assert.notEqual(alternative?.slug, "barbell-bench-press");
});

test("the same kind of movement is preferred over merely the same muscle", () => {
  const alternative = pickAlternative({
    current: find("barbell-squat"),
    catalogue,
    exclude: [],
  });
  // leg-press is the other compound; leg-extension only shares the muscle.
  assert.equal(alternative?.slug, "leg-press");
});

test("falling back to the muscle when no movement of the same kind is left", () => {
  const alternative = pickAlternative({
    current: find("barbell-squat"),
    catalogue,
    exclude: ["leg-press"],
  });
  assert.equal(alternative?.slug, "leg-extension");
});

test("swapping twice moves on rather than offering the same thing back", () => {
  const first = pickAlternative({
    current: find("barbell-bench-press"),
    catalogue,
    exclude: [],
  })!;
  const second = pickAlternative({
    current: find("barbell-bench-press"),
    catalogue,
    exclude: [first.slug],
  })!;
  assert.notEqual(first.slug, second.slug);
});

test("a neighbouring muscle stands in when its own group has nothing left", () => {
  // Shoulders are the only ombros movement here, so it falls back to chest —
  // near enough to keep the day doing what it set out to do.
  const alternative = pickAlternative({
    current: find("lateral-raise"),
    catalogue,
    exclude: [],
  });
  assert.equal(alternative?.muscle, "peito");
});

test("nothing at all yields nothing rather than a wrong exercise", () => {
  // Nowhere to go: its own group is empty and so are its neighbours.
  const alternative = pickAlternative({
    current: find("lateral-raise"),
    catalogue: [find("lateral-raise"), find("barbell-squat")],
    exclude: [],
  });
  assert.equal(alternative, null);
});

test("a whole day is swapped, keeping the order and the work already done", () => {
  const swaps = swapDay({
    items: [
      { position: 0, slug: "barbell-squat", touched: true },
      { position: 1, slug: "barbell-bench-press", touched: false },
      { position: 2, slug: "lateral-raise", touched: false },
    ],
    catalogue,
  });

  // The squat was already worked, so it stays out of it.
  assert.ok(swaps.every((swap) => swap.from !== "barbell-squat"));

  // Of the two remaining chest compounds, the stable order picks the first.
  assert.deepEqual(swaps[0], {
    position: 1,
    from: "barbell-bench-press",
    to: "chest-press-machine",
  });

  // The lateral raise falls back to a neighbouring group rather than staying.
  assert.equal(swaps.length, 2);
  assert.equal(swaps[1].from, "lateral-raise");
});

test("a day never ends up with the same exercise twice", () => {
  const swaps = swapDay({
    items: [
      { position: 0, slug: "barbell-bench-press", touched: false },
      { position: 1, slug: "chest-press-machine", touched: false },
    ],
    catalogue,
  });

  const landing = swaps.map((swap) => swap.to);
  assert.equal(new Set(landing).size, landing.length);
  for (const swap of swaps) {
    assert.ok(!["barbell-bench-press", "chest-press-machine"].includes(swap.to));
  }
});

test("a slot does not offer back what it has already turned down", () => {
  // The squat became the front squat; swapping again must not go back to it.
  const swaps = swapDay({
    items: [
      {
        position: 0,
        slug: "leg-press",
        touched: false,
        rejected: ["barbell-squat"],
      },
    ],
    catalogue,
  });

  assert.equal(swaps.length, 1);
  assert.notEqual(swaps[0].to, "barbell-squat");
  assert.equal(swaps[0].to, "leg-extension");
});
