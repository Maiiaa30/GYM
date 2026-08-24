/**
 * Which weekdays a block is trained on.
 *
 * A training day used to be called "Dia A", which says nothing to anyone
 * standing in a gym. Naming the days after the weekday they fall on makes the
 * block readable at a glance and lets the opening screen suggest the day that
 * matches today instead of counting sessions.
 *
 * The spread is deliberate rather than arithmetic: three days a week is Monday,
 * Wednesday, Friday because that is how people actually train, not because 7/3
 * rounds that way.
 */

/** Monday first, the way a Portuguese week is read. */
export const WEEKDAY_NAMES = [
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
  "Domingo",
];

const SPREAD: Record<number, number[]> = {
  1: [0],
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
  5: [0, 1, 2, 3, 4],
  6: [0, 1, 2, 3, 4, 5],
  7: [0, 1, 2, 3, 4, 5, 6],
};

/** Weekday numbers for a block, Monday being 0. */
export function trainingWeekdays(daysPerWeek: number): number[] {
  const count = Math.min(Math.max(Math.round(daysPerWeek), 1), 7);
  return SPREAD[count];
}

/** The name of each training day: "Segunda", "Quarta", "Sexta". */
export function trainingDayNames(daysPerWeek: number): string[] {
  return trainingWeekdays(daysPerWeek).map((day) => WEEKDAY_NAMES[day]);
}

/** Monday is 0, to match the spread above. */
export function weekdayOf(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;
}

/**
 * The day to open on.
 *
 * If today is one of the training days, that is the one they came for. On any
 * other day — a session missed, a Sunday, a gym that was full — fall back to
 * the rotation, so the block is still worked through in order rather than
 * stalling on whichever day happens to be nearest.
 */
export function suggestedDayIndex(input: {
  today: string;
  daysPerWeek: number;
  completedSessions: number;
}): number {
  const weekdays = trainingWeekdays(input.daysPerWeek);
  const match = weekdays.indexOf(weekdayOf(input.today));
  if (match !== -1) return match;
  return weekdays.length > 0
    ? input.completedSessions % weekdays.length
    : 0;
}
