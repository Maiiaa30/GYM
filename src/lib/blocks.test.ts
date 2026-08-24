import assert from "node:assert/strict";
import { test } from "node:test";
import { buildBlocks, groupForPairing, pairMembers } from "./blocks.ts";

type Item = { exercise: string; position: number; supersetGroup: number | null };
const toBlocks = (items: Item[]) => buildBlocks(items, (item) => item.exercise);

const item = (exercise: string, position: number, supersetGroup: number | null = null) => ({
  exercise,
  position,
  supersetGroup,
});

test("exercises without a group stand alone", () => {
  const blocks = toBlocks([item("a", 0), item("b", 1)]);
  assert.equal(blocks.length, 2);
  assert.ok(blocks.every((block) => block.group === null));
});

test("consecutive members of a group form one block", () => {
  const blocks = toBlocks([
    item("a", 0),
    item("b", 1, 1),
    item("c", 2, 1),
    item("d", 3),
  ]);
  assert.equal(blocks.length, 3);
  assert.deepEqual(
    blocks[1].items.map((i) => i.exercise),
    ["b", "c"],
  );
  assert.equal(blocks[1].group, 1);
});

test("a group left with one member dissolves itself", () => {
  const blocks = toBlocks([item("a", 0, 2), item("b", 1)]);
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].group, null);
});

test("the same group number split apart does not jump the gap", () => {
  const blocks = toBlocks([
    item("a", 0, 1),
    item("b", 1, 1),
    item("c", 2),
    item("d", 3, 1),
  ]);
  assert.equal(blocks.length, 3);
  assert.deepEqual(
    blocks.map((block) => block.items.length),
    [2, 1, 1],
  );
});

test("items are read in position order, not array order", () => {
  const blocks = toBlocks([item("b", 1), item("a", 0)]);
  assert.equal(blocks[0].items[0].exercise, "a");
});

test("pairing with a plain exercise opens a new group", () => {
  const items = [item("a", 0), item("b", 1)];
  assert.equal(groupForPairing(items, "b"), 1);
  assert.deepEqual(pairMembers(items, "b"), ["a", "b"]);
});

test("pairing with an existing group joins it", () => {
  const items = [item("a", 0, 3), item("b", 1, 3), item("c", 2)];
  assert.equal(groupForPairing(items, "c"), 3);
  assert.deepEqual(pairMembers(items, "c"), ["c"]);
});

test("a new group number never collides with one in use", () => {
  const items = [item("a", 0, 5), item("b", 1, 5), item("c", 2), item("d", 3)];
  assert.equal(groupForPairing(items, "d"), 6);
});

test("the first exercise has nothing to pair with", () => {
  const items = [item("a", 0), item("b", 1)];
  assert.equal(groupForPairing(items, "a"), null);
  assert.deepEqual(pairMembers(items, "a"), []);
});
