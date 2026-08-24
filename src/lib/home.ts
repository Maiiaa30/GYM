/**
 * Arithmetic for the opening screen.
 *
 * Dates arrive as plain `YYYY-MM-DD` strings and are compared as such: parsing
 * them into local `Date` objects would move a session across midnight for
 * anyone training late, which is exactly when this happens.
 */

/** Monday first, the way a Portuguese week is read. */
const WEEKDAY_INITIALS = ["S", "T", "Q", "Q", "S", "S", "D"];

export type DaySlot = {
  date: string;
  initial: string;
  trained: boolean;
  isToday: boolean;
  isFuture: boolean;
};

function utc(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

/**
 * The inverse of `utc` above: these are date-only timestamps built with
 * `Date.UTC`, never "now", so reading them back in UTC is exact. What day it
 * is today comes from `lib/clock`.
 */
function iso(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

const DAY = 86_400_000;

/** Monday of the week `date` falls in. */
export function weekStart(date: string): string {
  const time = utc(date);
  const weekday = new Date(time).getUTCDay(); // 0 = Sunday
  const offset = (weekday + 6) % 7;
  return iso(time - offset * DAY);
}

/**
 * The current week as seven slots, so the strip can show what was trained,
 * what is still to come, and where today sits.
 */
export function weekDays(trainedOn: string[], today: string): DaySlot[] {
  const done = new Set(trainedOn);
  const start = utc(weekStart(today));
  const now = utc(today);

  return WEEKDAY_INITIALS.map((initial, index) => {
    const time = start + index * DAY;
    const date = iso(time);
    return {
      date,
      initial,
      trained: done.has(date),
      isToday: time === now,
      isFuture: time > now,
    };
  });
}

/**
 * Consecutive weeks in which the weekly target was met, counting back from the
 * current one. The current week never breaks the streak: it is still running,
 * and a Tuesday should not read as a failure.
 */
export function weekStreak(
  trainedOn: string[],
  today: string,
  target: number,
): number {
  if (target <= 0) return 0;

  const perWeek = new Map<string, number>();
  for (const date of new Set(trainedOn)) {
    const week = weekStart(date);
    perWeek.set(week, (perWeek.get(week) ?? 0) + 1);
  }

  let cursor = utc(weekStart(today));
  let streak = 0;

  // The week in progress only ever adds to the streak.
  if ((perWeek.get(iso(cursor)) ?? 0) >= target) streak += 1;
  cursor -= 7 * DAY;

  while ((perWeek.get(iso(cursor)) ?? 0) >= target) {
    streak += 1;
    cursor -= 7 * DAY;
  }

  return streak;
}

/** Sessions trained in the week `today` falls in. */
export function trainedThisWeek(trainedOn: string[], today: string): number {
  const week = weekStart(today);
  return new Set(trainedOn.filter((date) => weekStart(date) === week)).size;
}

/**
 * Total load moved: every completed working set counts weight by repetitions.
 * A set with no weight — bodyweight, a hold — contributes nothing, which is
 * why the number is presented as volume rather than as effort.
 */
export function volumeOf(
  sets: Array<{ weightKg: number | null; reps: number | null }>,
): number {
  let total = 0;
  for (const set of sets) {
    if (set.weightKg === null || set.reps === null) continue;
    total += set.weightKg * set.reps;
  }
  return Math.round(total);
}

/** Whole minutes between two timestamps, or null while a session is open. */
export function minutesBetween(
  startedAt: string,
  endedAt: string | null,
): number | null {
  if (!endedAt) return null;
  const minutes = Math.round(
    (Date.parse(endedAt) - Date.parse(startedAt)) / 60_000,
  );
  return minutes >= 0 ? minutes : null;
}

/**
 * Grouped in threes the way Portuguese writes a large number. The separator is
 * a non-breaking space, written as an escape so it cannot be confused with a
 * plain one, so a volume never wraps across two lines on a phone.
 */
export function formatVolume(kg: number): string {
  return String(Math.round(kg)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
}

/** How long ago, in the words the interface uses: "hoje", "ontem", "há 3 dias". */
export function relativeDay(date: string, today: string): string {
  const days = Math.round((utc(today) - utc(date)) / DAY);
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 7) return `há ${days} dias`;
  if (days < 14) return "há uma semana";
  if (days < 31) return `há ${Math.floor(days / 7)} semanas`;
  return "há mais de um mês";
}
