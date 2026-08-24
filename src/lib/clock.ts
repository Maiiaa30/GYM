/**
 * What day it is where these two actually train.
 *
 * Everything used to take the date from `toISOString()`, which is UTC. The
 * server runs in UTC and Portugal is an hour ahead of it for seven months of
 * the year, so a session started between midnight and one in the morning was
 * filed under the previous day: it landed on the wrong square of the activity
 * grid, counted towards the wrong week, and could let a second session be
 * started because the first "was not today".
 *
 * One hour a night is not much, but it is exactly the hour someone finishing a
 * late session is in. Dates are now read in the zone the gym is in.
 */

export const TIME_ZONE = "Europe/Lisbon";

/**
 * `en-CA` formats as YYYY-MM-DD, which is the shape every date column and
 * every comparison in this application already uses.
 */
const ISO_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The calendar day `at` falls on in Lisbon, as `YYYY-MM-DD`. */
export function dayIn(at: Date = new Date()): string {
  return ISO_DAY.format(at);
}

/** Today in Lisbon. */
export function today(): string {
  return dayIn();
}

/** A day offset from today, still in Lisbon. Negative goes back. */
export function daysFromToday(days: number): string {
  return dayIn(new Date(Date.now() + days * 86_400_000));
}
