"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, cx } from "@/components/ui";
import { platesForWeight } from "@/lib/progression";
import type { LiftFamily } from "@/lib/database.types";
import { abandonSession, finishSession, logSet } from "../actions";

export type RunnerSet = {
  id: string;
  setNo: number;
  isWarmup: boolean;
  targetKg: number | null;
  weightKg: number | null;
  reps: number | null;
  completed: boolean;
};

export type RunnerExercise = {
  slug: string;
  name: string;
  muscle: string;
  images: string[];
  cues: string[];
  family: LiftFamily;
  increment: number;
  repLow: number;
  repHigh: number;
  restSec: number;
  notes: string | null;
  last: { weightKg: number | null; reps: number | null; on: string } | null;
  partner: { name: string | null; weightKg: number | null; reps: number | null } | null;
  sets: RunnerSet[];
};

/** A short tone at the end of the rest period. No audio file to download. */
function beep() {
  try {
    const AudioCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtor) return;
    const context = new AudioCtor();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 660;
    oscillator.type = "sine";
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.45);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.5);
    oscillator.onended = () => void context.close();
  } catch {
    // Audio is a convenience; never let it break the session.
  }
}

function formatClock(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

export function SessionRunner({
  sessionId,
  dayName,
  focus,
  exercises: initial,
}: {
  sessionId: string;
  dayName: string;
  focus: string | null;
  exercises: RunnerExercise[];
}) {
  const [exercises, setExercises] = useState(initial);
  const [index, setIndex] = useState(0);
  const [showDemo, setShowDemo] = useState(false);
  const [rest, setRest] = useState<number | null>(null);

  const exercise = exercises[index];
  const isLast = index === exercises.length - 1;
  const isBodyweight = exercise.family === "bodyweight";

  const workingSets = useMemo(
    () => exercise.sets.filter((set) => !set.isWarmup),
    [exercise.sets],
  );
  const warmups = useMemo(
    () => exercise.sets.filter((set) => set.isWarmup),
    [exercise.sets],
  );

  const target =
    workingSets.find((set) => !set.completed)?.targetKg ??
    workingSets[0]?.targetKg ??
    null;

  /* ------------------------------------------------------------- timer */

  useEffect(() => {
    if (rest === null) return;
    if (rest <= 0) {
      beep();
      setRest(null);
      return;
    }
    const timer = window.setTimeout(() => setRest((value) => (value ?? 1) - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [rest]);

  /* ------------------------------------------------------------ actions */

  const patchSet = useCallback(
    (setId: string, patch: Partial<RunnerSet>) => {
      setExercises((current) =>
        current.map((item) => ({
          ...item,
          sets: item.sets.map((set) =>
            set.id === setId ? { ...set, ...patch } : set,
          ),
        })),
      );
    },
    [],
  );

  const persist = useCallback(
    (set: RunnerSet, patch: Partial<RunnerSet>) => {
      const merged = { ...set, ...patch };
      void logSet({
        setLogId: set.id,
        weightKg: merged.weightKg,
        reps: merged.reps,
        completed: merged.completed,
      });
    },
    [],
  );

  const adjustTarget = useCallback(
    (delta: number) => {
      setExercises((current) =>
        current.map((item, itemIndex) => {
          if (itemIndex !== index) return item;
          return {
            ...item,
            sets: item.sets.map((set) => {
              if (set.isWarmup || set.completed) return set;
              const base = set.targetKg ?? 0;
              const next = Math.max(0, Math.round((base + delta) * 2) / 2);
              return { ...set, targetKg: next };
            }),
          };
        }),
      );
    },
    [index],
  );

  const toggleSet = useCallback(
    (set: RunnerSet) => {
      if (set.completed) {
        patchSet(set.id, { completed: false });
        persist(set, { completed: false });
        return;
      }

      const reps = set.reps ?? (set.isWarmup ? null : exercise.repLow);
      const weight = set.weightKg ?? set.targetKg;

      patchSet(set.id, { completed: true, reps, weightKg: weight });
      persist(set, { completed: true, reps, weightKg: weight });

      if (!set.isWarmup) setRest(exercise.restSec);
    },
    [exercise.repLow, exercise.restSec, patchSet, persist],
  );

  const changeReps = useCallback(
    (set: RunnerSet, reps: number) => {
      const safe = Math.max(0, Math.min(200, reps));
      patchSet(set.id, { reps: safe });
      if (set.completed) persist(set, { reps: safe });
    },
    [patchSet, persist],
  );

  const goTo = useCallback((next: number) => {
    setIndex(next);
    setShowDemo(false);
    window.scrollTo?.(0, 0);
  }, []);

  const plates = target !== null && target > 0 ? platesForWeight(target) : null;
  const completedCount = exercises.filter((item) =>
    item.sets.filter((set) => !set.isWarmup).every((set) => set.completed),
  ).length;

  return (
    <div className="grid h-full grid-rows-[auto_1fr_auto]">
      {/* ------------------------------------------------------- header */}
      <header
        className="border-b border-line px-5 pb-3"
        style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="label">{dayName}</p>
            <p className="text-xs text-faint">{focus}</p>
          </div>
          <form action={abandonSession}>
            <input type="hidden" name="session_id" value={sessionId} />
            <button
              type="submit"
              className="text-xs uppercase tracking-[0.14em] text-faint"
            >
              Abandon
            </button>
          </form>
        </div>
        <div className="mt-3 flex gap-1">
          {exercises.map((item, itemIndex) => {
            const done = item.sets
              .filter((set) => !set.isWarmup)
              .every((set) => set.completed);
            return (
              <button
                key={item.slug}
                onClick={() => goTo(itemIndex)}
                aria-label={item.name}
                className={cx(
                  "h-1 flex-1 rounded-full transition-colors",
                  itemIndex === index
                    ? "bg-brass"
                    : done
                      ? "bg-brass-dim"
                      : "bg-line",
                )}
              />
            );
          })}
        </div>
      </header>

      {/* --------------------------------------------------------- body */}
      <div className="scroll-area px-5 py-5">
        <div className="mx-auto w-full max-w-md space-y-5">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-3xl leading-tight">
              {exercise.name}
            </h1>
            <p className="label mt-1">
              {exercise.muscle} · {workingSets.length} ×{" "}
              {exercise.repLow === exercise.repHigh
                ? exercise.repLow
                : `${exercise.repLow}–${exercise.repHigh}`}
              {exercise.notes ? ` · ${exercise.notes}` : ""}
            </p>
          </div>

          <button
            onClick={() => setShowDemo((value) => !value)}
            className="text-sm text-brass underline underline-offset-4"
          >
            {showDemo ? "Hide the technique" : "How to do it"}
          </button>

          {showDemo ? (
            <Card className="overflow-hidden">
              <div className="grid grid-cols-2 gap-px bg-line">
                {exercise.images.slice(0, 2).map((src, imageIndex) => (
                  <Image
                    key={src}
                    src={src}
                    alt={`${exercise.name}, position ${imageIndex + 1}`}
                    width={400}
                    height={300}
                    className="h-auto w-full bg-raised object-cover"
                    unoptimized
                  />
                ))}
              </div>
              <ul className="space-y-2 p-4">
                {exercise.cues.map((cue) => (
                  <li key={cue} className="flex gap-2 text-sm text-muted">
                    <span className="text-brass">—</span>
                    <span>{cue}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {/* ------------------------------------------------- load */}
          {isBodyweight ? (
            <Card className="p-5">
              <p className="label">Bodyweight</p>
              <p className="mt-1 text-sm text-muted">
                Progress by repetitions. Add one repetition per set before you
                add difficulty.
              </p>
            </Card>
          ) : (
            <Card className="p-5">
              <p className="label">Working weight</p>
              <div className="mt-3 flex items-center justify-between gap-4">
                <Button
                  variant="quiet"
                  size="lg"
                  aria-label="Reduce the weight"
                  onClick={() => adjustTarget(-exercise.increment)}
                  className="w-14"
                >
                  −
                </Button>
                <p className="tabular font-[family-name:var(--font-display)] text-5xl">
                  {target === null ? "—" : target}
                  <span className="ml-1 text-lg text-muted">kg</span>
                </p>
                <Button
                  variant="quiet"
                  size="lg"
                  aria-label="Increase the weight"
                  onClick={() => adjustTarget(exercise.increment)}
                  className="w-14"
                >
                  +
                </Button>
              </div>

              {target === null ? (
                <p className="mt-3 text-sm text-muted">
                  First time on this movement. Start light enough to complete
                  every repetition with clean technique.
                </p>
              ) : null}

              {plates?.loadable && plates.perSide.length > 0 ? (
                <p className="mt-3 text-xs text-faint">
                  Per side: {plates.perSide.join(" + ")} kg on a{" "}
                  {plates.barKg} kg bar
                </p>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-faint">
                {exercise.last ? (
                  <span>
                    Last time: {exercise.last.weightKg ?? "—"} kg ×{" "}
                    {exercise.last.reps ?? "—"} on {exercise.last.on}
                  </span>
                ) : (
                  <span>No history yet</span>
                )}
                {exercise.partner ? (
                  <span>
                    {exercise.partner.name ?? "Partner"}:{" "}
                    {exercise.partner.weightKg ?? "—"} kg
                  </span>
                ) : null}
              </div>
            </Card>
          )}

          {/* ------------------------------------------------- sets */}
          {warmups.length > 0 ? (
            <section>
              <p className="label mb-2">Warm-up</p>
              <Card className="divide-y divide-line">
                {warmups.map((set) => (
                  <SetRow
                    key={set.id}
                    set={set}
                    repTarget={null}
                    bodyweight={isBodyweight}
                    onToggle={() => toggleSet(set)}
                    onReps={(reps) => changeReps(set, reps)}
                  />
                ))}
              </Card>
            </section>
          ) : null}

          <section>
            <p className="label mb-2">Working sets</p>
            <Card className="divide-y divide-line">
              {workingSets.map((set) => (
                <SetRow
                  key={set.id}
                  set={set}
                  repTarget={exercise.repLow}
                  bodyweight={isBodyweight}
                  onToggle={() => toggleSet(set)}
                  onReps={(reps) => changeReps(set, reps)}
                />
              ))}
            </Card>
          </section>
        </div>
      </div>

      {/* -------------------------------------------------------- footer */}
      <footer
        className="border-t border-line bg-ink px-5 pt-3"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        {rest !== null ? (
          <button
            onClick={() => setRest(null)}
            className="mb-3 flex w-full items-center justify-between rounded-[var(--radius-md)] border border-brass-dim px-4 py-2"
          >
            <span className="label">Rest</span>
            <span className="tabular font-[family-name:var(--font-display)] text-2xl text-brass">
              {formatClock(rest)}
            </span>
            <span className="text-xs text-faint">Tap to skip</span>
          </button>
        ) : null}

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={() => goTo(Math.max(0, index - 1))}
            disabled={index === 0}
            className="w-24"
          >
            Back
          </Button>
          <span className="tabular flex-1 text-center text-xs text-faint">
            {completedCount} of {exercises.length} done
          </span>
          {isLast ? (
            <form action={finishSession}>
              <input type="hidden" name="session_id" value={sessionId} />
              <Button type="submit" className="w-28">
                Finish
              </Button>
            </form>
          ) : (
            <Button onClick={() => goTo(index + 1)} className="w-28">
              Next
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}

function SetRow({
  set,
  repTarget,
  bodyweight,
  onToggle,
  onReps,
}: {
  set: RunnerSet;
  repTarget: number | null;
  bodyweight: boolean;
  onToggle: () => void;
  onReps: (reps: number) => void;
}) {
  const weight = set.weightKg ?? set.targetKg;

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="tabular w-6 text-sm text-faint">{set.setNo}</span>

      {!bodyweight ? (
        <span className="tabular w-20 text-sm">
          {weight === null ? "—" : `${weight} kg`}
        </span>
      ) : null}

      <label className="flex flex-1 items-center gap-2">
        <span className="sr-only">Repetitions</span>
        <input
          type="number"
          inputMode="numeric"
          value={set.reps ?? ""}
          placeholder={repTarget !== null ? String(repTarget) : "—"}
          onChange={(event) => onReps(Number(event.target.value))}
          className="tabular h-10 w-16 rounded-[var(--radius-sm)] border border-line bg-surface px-2 text-center focus:border-brass focus:outline-none"
        />
        <span className="text-xs text-faint">reps</span>
      </label>

      <button
        onClick={onToggle}
        aria-pressed={set.completed}
        aria-label={set.completed ? "Mark as not done" : "Mark as done"}
        className={cx(
          "flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] border transition-colors",
          set.completed
            ? "border-brass bg-brass text-ink"
            : "border-line-strong text-faint",
        )}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M4 12.5l5 5L20 7" />
        </svg>
      </button>
    </div>
  );
}
