/**
 * Grouping a session into blocks.
 *
 * A block is what you work through before resting: usually one exercise, and
 * for a superset the two or three that are done back to back. Consecutive
 * items carrying the same group number belong together; anything else stands
 * alone, including a group left with a single member after its partner was
 * removed.
 */

export type Groupable = {
  position: number;
  supersetGroup: number | null;
};

/** Pairing works on session rows, which name their exercise. */
export type Pairable = Groupable & { exercise: string };

export type Block<T extends Groupable> = {
  key: string;
  group: number | null;
  items: T[];
};

export function buildBlocks<T extends Groupable>(
  items: T[],
  keyOf: (item: T) => string,
): Block<T>[] {
  const ordered = [...items].sort((a, b) => a.position - b.position);
  const blocks: Block<T>[] = [];

  for (const item of ordered) {
    const previous = blocks[blocks.length - 1];

    if (
      item.supersetGroup !== null &&
      previous &&
      previous.group === item.supersetGroup
    ) {
      previous.items.push(item);
      continue;
    }

    blocks.push({
      key: keyOf(item),
      group: item.supersetGroup,
      items: [item],
    });
  }

  // A group of one is not a superset; it is an exercise.
  return blocks.map((block) =>
    block.items.length === 1 ? { ...block, group: null } : block,
  );
}

/**
 * The group number to use when pairing an item with the one before it: the
 * previous item's group if it already has one, otherwise a fresh number.
 */
export function groupForPairing(
  items: Pairable[],
  target: string,
): number | null {
  const ordered = [...items].sort((a, b) => a.position - b.position);
  const index = ordered.findIndex((item) => item.exercise === target);
  if (index <= 0) return null;

  const previous = ordered[index - 1];
  if (previous.supersetGroup !== null) return previous.supersetGroup;

  const used = ordered
    .map((item) => item.supersetGroup)
    .filter((group): group is number => group !== null);

  return (used.length > 0 ? Math.max(...used) : 0) + 1;
}

/** The exercises that would join the group, so both ends can be written. */
export function pairMembers(items: Pairable[], target: string): string[] {
  const ordered = [...items].sort((a, b) => a.position - b.position);
  const index = ordered.findIndex((item) => item.exercise === target);
  if (index <= 0) return [];

  const previous = ordered[index - 1];
  return previous.supersetGroup !== null
    ? [target]
    : [previous.exercise, target];
}
