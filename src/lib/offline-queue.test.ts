import assert from "node:assert/strict";
import { test } from "node:test";
import { mergePending, type PendingSet } from "./offline-queue.ts";

const entry = (
  setLogId: string,
  queuedAt: number,
  overrides: Partial<PendingSet> = {},
): PendingSet => ({
  setLogId,
  weightKg: 60,
  reps: 5,
  completed: true,
  queuedAt,
  ...overrides,
});

test("only the last state of a set is replayed", () => {
  const merged = mergePending([
    entry("a", 1, { completed: true, reps: 5 }),
    entry("a", 2, { completed: true, reps: 4 }),
    entry("a", 3, { completed: false, reps: null }),
  ]);

  assert.equal(merged.length, 1);
  assert.equal(merged[0].completed, false);
  assert.equal(merged[0].reps, null);
});

test("different sets are all kept, oldest first", () => {
  const merged = mergePending([entry("b", 5), entry("a", 2), entry("c", 9)]);
  assert.deepEqual(
    merged.map((item) => item.setLogId),
    ["a", "b", "c"],
  );
});

test("an empty queue merges to nothing", () => {
  assert.deepEqual(mergePending([]), []);
});

test("entries queued in the same millisecond keep the later one", () => {
  const merged = mergePending([
    entry("a", 7, { reps: 5 }),
    entry("a", 7, { reps: 8 }),
  ]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].reps, 8);
});
