/**
 * Whether the training is actually turning into anything.
 *
 * The application has held every piece of this from the start — body weight
 * over time, a goal, and a complete record of sessions — and never once put
 * them together. For two lean beginners who want to put on muscle, the limit
 * is almost never the programme: it is that they are not eating enough. Saying
 * so, from their own numbers, is the most useful sentence this can produce.
 *
 * It reports what the readings show and stays out of anything it cannot know.
 * No calories, no diet, no advice beyond "this is not moving".
 */

export type WeightReading = { on: string; kg: number };

export type Direction = "gain" | "lose" | "unknown";

export type Verdict =
  /** Not enough readings, or not enough time, to say anything honest. */
  | { state: "too-soon"; weeks: number; readings: number }
  /** Weight is moving the way they want it to. */
  | { state: "on-track"; changeKg: number; weeks: number; sessions: number }
  /** Training, but the scale has not moved. */
  | { state: "stuck"; changeKg: number; weeks: number; sessions: number }
  /** Moving the wrong way. */
  | { state: "wrong-way"; changeKg: number; weeks: number; sessions: number }
  /** The scale is not moving because barely anything is happening. */
  | { state: "not-training"; weeks: number; sessions: number };

/** Below this, a change is the scale's noise rather than a trend. */
const NOISE_KG = 0.6;

/** Less than this and there is nothing to read yet. */
const MIN_WEEKS = 3;

/** Roughly twice a week over the window: enough to expect a result. */
const sessionsExpected = (weeks: number) => Math.max(4, Math.round(weeks * 1.5));

const DAY = 86_400_000;

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY);
}

/**
 * Reads the trend over the most recent window.
 *
 * `readings` must be oldest first. `sessions` is how many workouts were
 * finished inside the same window — without it, a flat scale cannot be told
 * apart from someone who simply has not been training.
 */
export function readTrend(input: {
  readings: WeightReading[];
  sessions: number;
  direction: Direction;
  windowDays?: number;
  today: string;
}): Verdict {
  const window = input.windowDays ?? 35;
  const from = new Date(Date.parse(input.today) - window * DAY)
    .toISOString()
    .slice(0, 10);

  const inWindow = input.readings.filter((reading) => reading.on >= from);
  const first = inWindow[0];
  const last = inWindow[inWindow.length - 1];

  if (!first || !last || inWindow.length < 2) {
    return { state: "too-soon", weeks: 0, readings: inWindow.length };
  }

  const days = daysBetween(first.on, last.on);
  const weeks = Math.round(days / 7);

  if (weeks < MIN_WEEKS) {
    return { state: "too-soon", weeks, readings: inWindow.length };
  }

  const changeKg = Math.round((last.kg - first.kg) * 10) / 10;

  // A scale that has not moved says nothing about food if nobody trained.
  if (input.sessions < sessionsExpected(weeks)) {
    return { state: "not-training", weeks, sessions: input.sessions };
  }

  const moved = Math.abs(changeKg) >= NOISE_KG;
  if (!moved) {
    return { state: "stuck", changeKg, weeks, sessions: input.sessions };
  }

  if (input.direction === "unknown") {
    return { state: "on-track", changeKg, weeks, sessions: input.sessions };
  }

  const rightWay =
    input.direction === "gain" ? changeKg > 0 : changeKg < 0;

  return rightWay
    ? { state: "on-track", changeKg, weeks, sessions: input.sessions }
    : { state: "wrong-way", changeKg, weeks, sessions: input.sessions };
}

/** Which way they are trying to go, from the goal they set. */
export function directionOf(
  currentKg: number | null,
  goalKg: number | null,
): Direction {
  if (currentKg === null || goalKg === null) return "unknown";
  if (goalKg > currentKg + 1) return "gain";
  if (goalKg < currentKg - 1) return "lose";
  return "unknown";
}

function kg(value: number): string {
  const rounded = Math.abs(value).toFixed(1).replace(".", ",").replace(/,0$/, "");
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${rounded} kg`;
}

const weeksLabel = (weeks: number) =>
  weeks === 1 ? "uma semana" : `${weeks} semanas`;

const sessionsLabel = (sessions: number) =>
  sessions === 1 ? "1 treino" : `${sessions} treinos`;

/** The verdict in the words the interface uses. Null when there is nothing to say. */
export function describeTrend(
  verdict: Verdict,
  direction: Direction,
): { tone: "neutral" | "warn" | "good"; text: string } | null {
  switch (verdict.state) {
    case "too-soon":
      return null;

    case "not-training":
      return {
        tone: "neutral",
        text: `${sessionsLabel(verdict.sessions)} em ${weeksLabel(verdict.weeks)}. O peso só mexe quando os treinos são seguidos.`,
      };

    case "stuck":
      return {
        tone: "warn",
        text:
          direction === "gain"
            ? `${sessionsLabel(verdict.sessions)} em ${weeksLabel(verdict.weeks)} e o peso está no mesmo sítio. O treino está feito — o que falta é comer mais.`
            : `${sessionsLabel(verdict.sessions)} em ${weeksLabel(verdict.weeks)} e o peso está no mesmo sítio.`,
      };

    case "wrong-way":
      return {
        tone: "warn",
        text:
          direction === "gain"
            ? `${kg(verdict.changeKg)} em ${weeksLabel(verdict.weeks)}. Estás a treinar e a perder peso: não estás a comer o suficiente.`
            : `${kg(verdict.changeKg)} em ${weeksLabel(verdict.weeks)}, ao contrário do que querias.`,
      };

    case "on-track":
      return {
        tone: "good",
        text: `${kg(verdict.changeKg)} em ${weeksLabel(verdict.weeks)}, com ${sessionsLabel(verdict.sessions)}. Vai assim.`,
      };
  }
}
