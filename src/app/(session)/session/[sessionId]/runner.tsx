"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useFormStatus } from "react-dom";
import { Button, Card, Field, Notice, cx } from "@/components/ui";
import { NumericInput } from "@/components/numeric-input";
import { Sheet } from "@/components/sheet";
import {
  formatRepTarget,
  perSideLabel,
  platesForWeight,
} from "@/lib/progression";
import { useWakeLock } from "@/lib/use-wake-lock";
import { useOfflineQueue } from "@/lib/use-offline-queue";
import type { PendingSet } from "@/lib/offline-queue";
import type { LiftFamily, ProgressionAction } from "@/lib/database.types";
import { logBodyWeight, type BodyLogState } from "@/app/(app)/progress/actions";
import {
  abandonSession,
  addExerciseToSession,
  finishSession,
  logSet,
  pairWithPrevious,
  removeExerciseFromSession,
  swapExerciseInSession,
  swapWholeSession,
  unpairExercise,
} from "../actions";

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
  steps: string[];
  mistakes: string[];
  family: LiftFamily;
  increment: number;
  repLow: number;
  repHigh: number;
  restSec: number;
  notes: string | null;
  addedMidSession: boolean;
  position: number;
  supersetGroup: number | null;
  isTimed: boolean;
  perSide: boolean;
  action: ProgressionAction | null;
  reason: string;
  last: { weightKg: number | null; reps: number | null; on: string } | null;
  partner: { name: string | null; weightKg: number | null; reps: number | null } | null;
  sets: RunnerSet[];
};

export type RunnerBlock = {
  key: string;
  group: number | null;
  exercises: RunnerExercise[];
};

export type CatalogueOption = {
  slug: string;
  name: string;
  muscle: string;
  equipment: string;
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

const working = (exercise: RunnerExercise) =>
  exercise.sets.filter((set) => !set.isWarmup);

const blockDone = (block: RunnerBlock) =>
  block.exercises.every((exercise) =>
    working(exercise).every((set) => set.completed),
  );

export function SessionRunner({
  sessionId,
  dayName,
  focus,
  blocks: initial,
  available,
  needsBodyWeight,
  startedAt,
}: {
  sessionId: string;
  dayName: string;
  focus: string | null;
  blocks: RunnerBlock[];
  available: CatalogueOption[];
  needsBodyWeight: boolean;
  startedAt: string;
}) {
  const router = useRouter();
  const [blocks, setBlocks] = useState(initial);
  const [index, setIndex] = useState(0);
  const [showDemo, setShowDemo] = useState<string | null>(null);
  const [rest, setRest] = useState<number | null>(null);
  const [adjusting, setAdjusting] = useState(false);
  // Repetition targets are per exercise and last the session. The prescription
  // is a starting point, not an instruction: doing ten today and wanting
  // fifteen on the next set is the normal way this goes.
  const [repTargets, setRepTargets] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [muscleFilter, setMuscleFilter] = useState<string | null>(null);
  const [mutation, setMutation] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const wakeLock = useWakeLock(true);

  const send = useCallback(
    (entry: PendingSet) =>
      logSet({
        setLogId: entry.setLogId,
        weightKg: entry.weightKg,
        reps: entry.reps,
        completed: entry.completed,
      }),
    [],
  );
  const queue = useOfflineQueue(send);
  const finishForm = useRef<HTMLFormElement>(null);

  // The server owns the exercise list: adding, dropping or pairing refreshes
  // the route and the new prescription arrives as a prop.
  useEffect(() => {
    setBlocks(initial);
    setIndex((current) => Math.min(current, Math.max(initial.length - 1, 0)));
  }, [initial]);

  const block = blocks[index];
  const isLast = index === blocks.length - 1;
  const flat = useMemo(() => blocks.flatMap((item) => item.exercises), [blocks]);

  /* ------------------------------------------------------------- timer */

  useEffect(() => {
    if (rest === null) return;
    if (rest <= 0) {
      beep();
      setRest(null);
      return;
    }
    const timer = window.setTimeout(
      () => setRest((value) => (value ?? 1) - 1),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [rest]);

  /* ------------------------------------------------------------ actions */

  const patchSet = useCallback((setId: string, patch: Partial<RunnerSet>) => {
    setBlocks((current) =>
      current.map((item) => ({
        ...item,
        exercises: item.exercises.map((exercise) => ({
          ...exercise,
          sets: exercise.sets.map((set) =>
            set.id === setId ? { ...set, ...patch } : set,
          ),
        })),
      })),
    );
  }, []);

  const persist = useCallback(
    (set: RunnerSet, patch: Partial<RunnerSet>) => {
      const merged = { ...set, ...patch };
      void queue.record({
        setLogId: set.id,
        weightKg: merged.weightKg,
        reps: merged.reps,
        completed: merged.completed,
      });
    },
    [queue],
  );

  const targetReps = useCallback(
    (exercise: RunnerExercise) =>
      repTargets[exercise.slug] ?? exercise.repLow,
    [repTargets],
  );

  const adjustReps = useCallback(
    (exercise: RunnerExercise, delta: number) => {
      setRepTargets((current) => {
        const base = current[exercise.slug] ?? exercise.repLow;
        const limit = exercise.isTimed ? 600 : 200;
        return {
          ...current,
          [exercise.slug]: Math.max(1, Math.min(limit, base + delta)),
        };
      });
    },
    [],
  );

  const setTarget = useCallback((slug: string, kg: number | null) => {
    if (kg === null) return;
    setBlocks((current) =>
      current.map((item) => ({
        ...item,
        exercises: item.exercises.map((exercise) => {
          if (exercise.slug !== slug) return exercise;
          return {
            ...exercise,
            sets: exercise.sets.map((set) => {
              if (set.isWarmup || set.completed) return set;
              return { ...set, targetKg: Math.max(0, Math.round(kg * 2) / 2) };
            }),
          };
        }),
      })),
    );
  }, []);

  const adjustTarget = useCallback((slug: string, delta: number) => {
    setBlocks((current) =>
      current.map((item) => ({
        ...item,
        exercises: item.exercises.map((exercise) => {
          if (exercise.slug !== slug) return exercise;
          return {
            ...exercise,
            sets: exercise.sets.map((set) => {
              if (set.isWarmup || set.completed) return set;
              const base = set.targetKg ?? 0;
              const next = Math.max(0, Math.round((base + delta) * 2) / 2);
              return { ...set, targetKg: next };
            }),
          };
        }),
      })),
    );
  }, []);

  /**
   * Rest starts when the round is finished, which in a superset means after
   * the last exercise of the group rather than after every set.
   */
  const toggleSet = useCallback(
    (exercise: RunnerExercise, set: RunnerSet) => {
      if (set.completed) {
        patchSet(set.id, { completed: false });
        persist(set, { completed: false });
        return;
      }

      const reps = set.reps ?? (set.isWarmup ? null : targetReps(exercise));
      const weight = set.weightKg ?? set.targetKg;

      patchSet(set.id, { completed: true, reps, weightKg: weight });
      persist(set, { completed: true, reps, weightKg: weight });

      if (set.isWarmup) return;

      const members = block?.exercises ?? [];
      const lastOfRound =
        members.length <= 1 ||
        members[members.length - 1]?.slug === exercise.slug;

      if (lastOfRound) setRest(exercise.restSec);
    },
    [block, patchSet, persist, targetReps],
  );

  const changeReps = useCallback(
    (set: RunnerSet, reps: number | null) => {
      const safe = reps === null ? null : Math.max(0, Math.min(600, reps));
      patchSet(set.id, { reps: safe });
      if (set.completed) persist(set, { reps: safe });
    },
    [patchSet, persist],
  );

  const goTo = useCallback((next: number) => {
    setIndex(next);
    setShowDemo(null);
  }, []);

  const run = useCallback(
    (
      task: () => Promise<{ ok: boolean; error: string | null }>,
      close = false,
    ) => {
      setMutation(null);
      startTransition(async () => {
        const result = await task();
        if (!result.ok) {
          setMutation(result.error);
          return;
        }
        if (close) setAdjusting(false);
        router.refresh();
      });
    },
    [router],
  );

  // The list is already narrowed to the equipment they have; these narrow it
  // to the muscle they came for, which is how someone actually looks for a
  // replacement when a machine is taken.
  const muscles = useMemo(
    () => [...new Set(available.map((option) => option.muscle))].sort(),
    [available],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return available
      .filter((option) => !muscleFilter || option.muscle === muscleFilter)
      .filter(
        (option) =>
          !needle ||
          option.name.toLowerCase().includes(needle) ||
          option.muscle.toLowerCase().includes(needle) ||
          option.equipment.toLowerCase().includes(needle),
      )
      .slice(0, 40);
  }, [available, muscleFilter, search]);

  const completedCount = blocks.filter(blockDone).length;

  return (
    <div className="grid h-full grid-rows-[auto_1fr_auto]">
      {/* ------------------------------------------------------- header */}
      <header
        className="border-b border-line px-5 pb-3"
        style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
      >
        <div className="flex items-center gap-3">
          {/* Leaving is not the same as giving up: the session stays open and
              the opening screen offers it back. Abandoning lives in the sheet,
              where it cannot be hit by accident between sets. */}
          <Link
            href="/"
            aria-label="Sair sem terminar o treino"
            className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center text-muted"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.5]"
            >
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </Link>

          <div className="min-w-0 flex-1">
            <p className="label truncate">{dayName}</p>
            <p className="truncate text-xs text-faint">{focus}</p>
          </div>

          <Elapsed since={startedAt} />

          {!queue.online || queue.pending > 0 ? (
            <span
              className={cx(
                "shrink-0 rounded-full border px-2 py-0.5 text-[0.625rem] uppercase tracking-[0.14em]",
                queue.online
                  ? "border-brass-dim text-brass-dim"
                  : "border-line-strong text-faint",
              )}
            >
              {queue.online ? `${queue.pending} por enviar` : "Sem rede"}
            </span>
          ) : null}

          <button
            onClick={() => setAdjusting(true)}
            className="-mr-2 flex h-11 shrink-0 items-center px-2 text-xs uppercase tracking-[0.14em] text-brass"
          >
            Ajustar
          </button>
        </div>
        {blocks.length > 0 ? (
          <div className="mt-3 flex gap-1">
            {blocks.map((item, itemIndex) => (
              <button
                key={item.key}
                onClick={() => goTo(itemIndex)}
                aria-label={item.exercises.map((e) => e.name).join(" + ")}
                className={cx(
                  "h-1 flex-1 rounded-full transition-colors",
                  itemIndex === index
                    ? "bg-brass"
                    : blockDone(item)
                      ? "bg-brass-dim"
                      : "bg-line",
                )}
              />
            ))}
          </div>
        ) : null}
      </header>

      {/* --------------------------------------------------------- body */}
      <div className="scroll-area px-5 py-5">
        <div className="mx-auto w-full max-w-md space-y-5">
          {needsBodyWeight && index === 0 ? <BodyWeightPrompt /> : null}

          {!block ? (
            <Card className="p-5">
              <p className="label">Treino livre</p>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Ainda sem exercícios. Escolhe o primeiro e vai acrescentando à
                medida que treinas — cada um chega com a carga a que chegaste da
                última vez.
              </p>
              <Button
                className="mt-4 w-full"
                size="lg"
                onClick={() => setAdjusting(true)}
              >
                Escolher exercício
              </Button>
            </Card>
          ) : block.exercises.length === 1 ? (
            <ExercisePanel
              key={block.key}
              exercise={block.exercises[0]}
              repTarget={targetReps(block.exercises[0])}
              onAdjustReps={(delta) => adjustReps(block.exercises[0], delta)}
              showDemo={showDemo === block.exercises[0].slug}
              onToggleDemo={() =>
                setShowDemo((current) =>
                  current === block.exercises[0].slug
                    ? null
                    : block.exercises[0].slug,
                )
              }
              onAdjust={(delta) => adjustTarget(block.exercises[0].slug, delta)}
              onSetLoad={(kg) => setTarget(block.exercises[0].slug, kg)}
              onToggleSet={(set) => toggleSet(block.exercises[0], set)}
              onReps={changeReps}
            />
          ) : (
            <SupersetPanel
              key={block.key}
              block={block}
              showDemo={showDemo}
              onToggleDemo={(slug) =>
                setShowDemo((current) => (current === slug ? null : slug))
              }
              onAdjust={adjustTarget}
              onSetLoad={setTarget}
              onAdjustReps={adjustReps}
              repTargetFor={targetReps}
              onToggleSet={toggleSet}
              onReps={changeReps}
            />
          )}
        </div>
      </div>

      {/* -------------------------------------------------------- footer */}
      <footer
        className="relative border-t border-line bg-ink px-5 pt-3"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        {rest !== null ? (
          <button
            onClick={() => setRest(null)}
            className="absolute bottom-full left-0 right-0 flex w-full items-center justify-between gap-3 border-t border-brass-dim bg-ink px-5 py-2.5"
          >
            <span className="label">Descanso</span>
            <span className="tabular font-[family-name:var(--font-display)] text-2xl text-brass">
              {formatClock(rest)}
            </span>
            <span className="text-xs text-faint">Toca para saltar</span>
          </button>
        ) : null}

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={() => goTo(Math.max(0, index - 1))}
            disabled={index === 0}
            className="w-24"
          >
            Recuar
          </Button>
          <span className="tabular flex-1 text-center text-xs text-faint">
            {completedCount} de {blocks.length} feitos
          </span>
          {isLast || blocks.length === 0 ? (
            <form action={finishSession} ref={finishForm}>
              <input type="hidden" name="session_id" value={sessionId} />
              <Button
                type="button"
                className="w-28"
                disabled={blocks.length === 0}
                onClick={async () => {
                  // Finishing with sets still queued would compute the
                  // progression without them.
                  const left = await queue.flush();
                  if (left > 0) {
                    setMutation(
                      "Ainda há séries por enviar. Liga-te à rede antes de terminares.",
                    );
                    setAdjusting(true);
                    return;
                  }
                  finishForm.current?.requestSubmit();
                }}
              >
                Terminar
              </Button>
            </form>
          ) : (
            <Button onClick={() => goTo(index + 1)} className="w-28">
              Seguinte
            </Button>
          )}
        </div>
      </footer>

      {/* --------------------------------------------------------- sheet */}
      <Sheet
        open={adjusting}
        title="Ajustar o treino"
        onClose={() => setAdjusting(false)}
      >
        <div className="space-y-6 px-5 pt-4">
          {mutation ? <Notice tone="error">{mutation}</Notice> : null}

          {wakeLock.supported ? (
            <label className="flex items-center justify-between gap-4">
              <span>
                <span className="block text-sm">Manter o ecrã ligado</span>
                <span className="block text-xs text-faint">
                  Enquanto o treino estiver a decorrer.
                </span>
              </span>
              <input
                type="checkbox"
                checked={wakeLock.enabled}
                onChange={(event) => wakeLock.toggle(event.target.checked)}
                className="h-6 w-6 accent-[var(--color-brass)]"
              />
            </label>
          ) : null}

          {flat.length > 0 ? (
            <section>
              <p className="label mb-2">Exercícios de hoje</p>
              <ul className="divide-y divide-line rounded-[var(--radius-md)] border border-line">
                {flat.map((item, itemIndex) => (
                  <li key={item.slug} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm">
                        {item.name}
                        {item.supersetGroup !== null ? (
                          <span className="ml-2 text-xs text-brass-dim">
                            supersérie
                          </span>
                        ) : null}
                      </span>
                      <span className="flex shrink-0 items-center gap-3">
                        <button
                          onClick={() =>
                            run(() =>
                              swapExerciseInSession({
                                sessionId,
                                exercise: item.slug,
                              }),
                            )
                          }
                          disabled={pending}
                          className="text-xs uppercase tracking-[0.14em] text-brass disabled:opacity-40"
                        >
                          Trocar
                        </button>
                        <button
                          onClick={() =>
                            run(() =>
                              removeExerciseFromSession({
                                sessionId,
                                exercise: item.slug,
                              }),
                            )
                          }
                          disabled={pending || flat.length <= 1}
                          className="text-xs uppercase tracking-[0.14em] text-oxblood disabled:opacity-40"
                        >
                          Remover
                        </button>
                      </span>
                    </div>
                    {itemIndex > 0 ? (
                      <button
                        onClick={() =>
                          run(() =>
                            item.supersetGroup === null
                              ? pairWithPrevious({
                                  sessionId,
                                  exercise: item.slug,
                                })
                              : unpairExercise({
                                  sessionId,
                                  exercise: item.slug,
                                }),
                          )
                        }
                        disabled={pending}
                        className="mt-1 text-xs uppercase tracking-[0.14em] text-faint disabled:opacity-40"
                      >
                        {item.supersetGroup === null
                          ? "Juntar ao anterior"
                          : "Separar"}
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs leading-relaxed text-faint">
                Juntar dois exercícios faz uma supersérie: fazem-se de seguida,
                com um único descanso no fim de cada ronda. Trocar dá-te outro
                exercício para o mesmo músculo, para quando a máquina está
                ocupada ou avariada.
              </p>

              <Button
                variant="quiet"
                className="mt-4 w-full"
                disabled={pending}
                onClick={() => run(() => swapWholeSession({ sessionId }), true)}
              >
                Trocar o treino todo
              </Button>
              <p className="mt-2 text-xs leading-relaxed text-faint">
                Troca todos os exercícios que ainda não começaste por outros que
                trabalham os mesmos músculos. Os que já fizeste ficam.
              </p>
            </section>
          ) : null}

          <section className="pb-2">
            <p className="label mb-2">Adicionar exercício</p>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Procurar por nome, músculo ou equipamento"
              className="mb-3 h-12 w-full rounded-[var(--radius-md)] border border-line bg-raised px-3 placeholder:text-faint focus:border-brass focus:outline-none"
            />

            <div className="scroll-area -mx-5 mb-3 overflow-x-auto px-5">
              <div className="flex w-max gap-2">
                <FilterChip
                  active={muscleFilter === null}
                  onClick={() => setMuscleFilter(null)}
                >
                  Todos
                </FilterChip>
                {muscles.map((muscle) => (
                  <FilterChip
                    key={muscle}
                    active={muscleFilter === muscle}
                    onClick={() =>
                      setMuscleFilter((current) =>
                        current === muscle ? null : muscle,
                      )
                    }
                  >
                    {muscle}
                  </FilterChip>
                ))}
              </div>
            </div>
            <ul className="divide-y divide-line rounded-[var(--radius-md)] border border-line">
              {filtered.map((option) => (
                <li key={option.slug}>
                  <button
                    onClick={() =>
                      run(
                        () =>
                          addExerciseToSession({
                            sessionId,
                            exercise: option.slug,
                          }),
                        true,
                      )
                    }
                    disabled={pending}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left disabled:opacity-40"
                  >
                    <span className="text-sm">
                      {option.name}
                      <span className="mt-0.5 block text-xs text-faint">
                        {option.equipment}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-faint">
                      {option.muscle}
                    </span>
                  </button>
                </li>
              ))}
              {filtered.length === 0 ? (
                <li className="px-4 py-3 text-sm text-muted">
                  Nada encontrado.
                </li>
              ) : null}
            </ul>
          </section>

          <section className="border-t border-line pb-2 pt-5">
            <p className="label mb-2">Desistir</p>
            <p className="mb-3 text-xs leading-relaxed text-faint">
              Sair pela seta lá em cima deixa o treino a meio e podes voltar
              quando quiseres. Abandonar fecha-o de vez: não conta para o
              progresso nem sobe as cargas.
            </p>
            <form action={abandonSession}>
              <input type="hidden" name="session_id" value={sessionId} />
              <Button type="submit" variant="danger" className="w-full">
                Abandonar o treino
              </Button>
            </form>
          </section>
        </div>
      </Sheet>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "whitespace-nowrap rounded-full border px-3 py-1.5 text-xs transition-colors",
        active
          ? "border-brass bg-brass text-ink"
          : "border-line-strong text-muted",
      )}
    >
      {children}
    </button>
  );
}

/**
 * How long this has been going on.
 *
 * The whole plan is built around an hour and `started_at` was only ever read
 * once the session was over, so the one moment the number is useful — while
 * deciding whether there is time for another exercise — was the one moment it
 * was not shown.
 */
function Elapsed({ since }: { since: string }) {
  const started = Date.parse(since);
  const [minutes, setMinutes] = useState(() =>
    Math.max(0, Math.floor((Date.now() - started) / 60_000)),
  );

  useEffect(() => {
    const tick = () =>
      setMinutes(Math.max(0, Math.floor((Date.now() - started) / 60_000)));
    tick();
    // Re-reads the clock rather than counting, so a phone that slept through
    // twenty minutes comes back with the right number.
    const timer = window.setInterval(tick, 20_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [started]);

  if (Number.isNaN(started)) return null;

  return (
    <span className="tabular shrink-0 text-xs text-faint" aria-label="Tempo de treino">
      {minutes} min
    </span>
  );
}

/* ------------------------------------------------------- single exercise */

function ExercisePanel({
  exercise,
  showDemo,
  repTarget,
  onAdjustReps,
  onToggleDemo,
  onAdjust,
  onSetLoad,
  onToggleSet,
  onReps,
}: {
  exercise: RunnerExercise;
  showDemo: boolean;
  repTarget: number;
  onAdjustReps: (delta: number) => void;
  onToggleDemo: () => void;
  onAdjust: (delta: number) => void;
  onSetLoad: (kg: number | null) => void;
  onToggleSet: (set: RunnerSet) => void;
  onReps: (set: RunnerSet, reps: number | null) => void;
}) {
  const workingSets = working(exercise);
  const warmups = exercise.sets.filter((set) => set.isWarmup);

  return (
    <>
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl leading-tight">
          {exercise.name}
        </h1>
        <p className="label mt-1">
          {exercise.muscle} · {workingSets.length} ×{" "}
          {formatRepTarget({
            repLow: exercise.repLow,
            repHigh: exercise.repHigh,
            isTimed: exercise.isTimed,
          })}
          {exercise.perSide ? " no total" : ""}
          {exercise.notes ? ` · ${exercise.notes}` : ""}
        </p>
      </div>

      <button
        onClick={onToggleDemo}
        aria-expanded={showDemo}
        className="-my-2 flex h-11 items-center text-sm text-brass underline underline-offset-4"
      >
        {showDemo ? "Esconder a técnica" : "Como se faz"}
      </button>

      {showDemo ? <Demo exercise={exercise} /> : null}

      <LoadCard exercise={exercise} onAdjust={onAdjust} onSet={onSetLoad} />

      <RepsCard
        exercise={exercise}
        target={repTarget}
        onAdjust={onAdjustReps}
      />

      {warmups.length > 0 ? (
        <section>
          <p className="label mb-2">Aquecimento</p>
          <Card className="divide-y divide-line">
            {warmups.map((set) => (
              <SetRow
                key={set.id}
                set={set}
                repTarget={null}
                bodyweight={exercise.family === "bodyweight"}
                timed={exercise.isTimed}
                perSide={exercise.perSide}
                onToggle={() => onToggleSet(set)}
                onReps={(reps) => onReps(set, reps)}
              />
            ))}
          </Card>
        </section>
      ) : null}

      <section>
        <p className="label mb-2">
          {exercise.isTimed ? "Séries (segundos)" : "Séries de trabalho"}
        </p>
        <Card className="divide-y divide-line">
          {workingSets.map((set) => (
            <SetRow
              key={set.id}
              set={set}
              repTarget={repTarget}
              bodyweight={exercise.family === "bodyweight"}
              timed={exercise.isTimed}
              perSide={exercise.perSide}
              onToggle={() => onToggleSet(set)}
              onReps={(reps) => onReps(set, reps)}
            />
          ))}
        </Card>
      </section>
    </>
  );
}

/* ------------------------------------------------------------- superset */

function SupersetPanel({
  block,
  showDemo,
  onToggleDemo,
  onAdjust,
  onSetLoad,
  onAdjustReps,
  repTargetFor,
  onToggleSet,
  onReps,
}: {
  block: RunnerBlock;
  showDemo: string | null;
  onToggleDemo: (slug: string) => void;
  onAdjust: (slug: string, delta: number) => void;
  onSetLoad: (slug: string, kg: number | null) => void;
  onAdjustReps: (exercise: RunnerExercise, delta: number) => void;
  repTargetFor: (exercise: RunnerExercise) => number;
  onToggleSet: (exercise: RunnerExercise, set: RunnerSet) => void;
  onReps: (set: RunnerSet, reps: number | null) => void;
}) {
  const rounds = Math.max(
    ...block.exercises.map((exercise) => working(exercise).length),
  );

  return (
    <>
      <div>
        <p className="label">Supersérie</p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl leading-tight">
          {block.exercises.map((exercise) => exercise.name).join(" + ")}
        </h1>
        <p className="label mt-1">
          {rounds} rondas, sem descanso entre exercícios
        </p>
      </div>

      {block.exercises.map((exercise) => (
        <div key={exercise.slug} className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm text-parchment">{exercise.name}</p>
            <button
              onClick={() => onToggleDemo(exercise.slug)}
              className="text-xs text-brass underline underline-offset-4"
            >
              {showDemo === exercise.slug ? "Esconder" : "Como se faz"}
            </button>
          </div>
          {showDemo === exercise.slug ? <Demo exercise={exercise} /> : null}
          <LoadCard
            exercise={exercise}
            compact
            onAdjust={(delta) => onAdjust(exercise.slug, delta)}
            onSet={(kg) => onSetLoad(exercise.slug, kg)}
          />
          <RepsCard
            exercise={exercise}
            target={repTargetFor(exercise)}
            onAdjust={(delta) => onAdjustReps(exercise, delta)}
          />
        </div>
      ))}

      <section className="space-y-3">
        <p className="label">Rondas</p>
        {Array.from({ length: rounds }, (_, round) => (
          <Card key={round}>
            <p className="label px-4 pt-3">Ronda {round + 1}</p>
            <div className="mt-1 divide-y divide-line">
              {block.exercises.map((exercise) => {
                const set = working(exercise)[round];
                if (!set) return null;
                return (
                  <SetRow
                    key={set.id}
                    set={set}
                    label={exercise.name}
                    repTarget={repTargetFor(exercise)}
                    bodyweight={exercise.family === "bodyweight"}
                    timed={exercise.isTimed}
                    perSide={exercise.perSide}
                    onToggle={() => onToggleSet(exercise, set)}
                    onReps={(reps) => onReps(set, reps)}
                  />
                );
              })}
            </div>
          </Card>
        ))}
      </section>
    </>
  );
}

/* ---------------------------------------------------------------- pieces */

/**
 * What the movement actually is, for someone who has never done it. The two
 * catalogue frames are the start and the end of the lift, so they cross-fade
 * rather than sit side by side: the loop reads as a movement, which two stills
 * never do. Under reduced motion they fall back to the pair.
 */
function Demo({ exercise }: { exercise: RunnerExercise }) {
  const frames = exercise.images.slice(0, 2);

  return (
    <Card className="overflow-hidden">
      {frames.length > 0 ? (
        <figure className="m-0">
          <div className="demo-frames bg-raised">
            {frames.map((src, imageIndex) => (
              <Image
                key={src}
                src={src}
                alt={`${exercise.name}, posição ${imageIndex + 1}`}
                width={400}
                height={300}
                unoptimized
              />
            ))}
          </div>
          <figcaption className="border-t border-line px-4 py-2 text-center text-xs text-faint">
            {frames.length > 1
              ? "Do início ao fim do movimento"
              : "Posição do exercício"}
          </figcaption>
        </figure>
      ) : null}

      {exercise.steps.length > 0 ? (
        <section className="border-t border-line p-4">
          <p className="label mb-3">Passo a passo</p>
          <ol className="space-y-2.5">
            {exercise.steps.map((step, stepIndex) => (
              <li key={step} className="flex gap-3 text-sm leading-relaxed">
                <span className="tabular w-4 shrink-0 text-brass">
                  {stepIndex + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {exercise.mistakes.length > 0 ? (
        <section className="border-t border-line p-4">
          <p className="label mb-3">Erros comuns</p>
          <ul className="space-y-2">
            {exercise.mistakes.map((mistake) => (
              <li
                key={mistake}
                className="flex gap-3 text-sm leading-relaxed text-muted"
              >
                <span className="text-oxblood" aria-hidden="true">
                  ×
                </span>
                <span>{mistake}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {exercise.cues.length > 0 ? (
        <section className="border-t border-line p-4">
          <p className="label mb-3">A não esquecer</p>
          <ul className="space-y-2">
            {exercise.cues.map((cue) => (
              <li
                key={cue}
                className="flex gap-3 text-sm leading-relaxed text-muted"
              >
                <span className="text-brass" aria-hidden="true">
                  —
                </span>
                <span>{cue}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </Card>
  );
}

/** Progression only moves the load on some sessions; those are the ones worth
 *  a whole panel. On every other exercise the weight is a single line that
 *  opens when tapped, so the screen stays about the sets. */
function weightMoved(action: ProgressionAction | null) {
  return action === "increase" || action === "deload" || action === "start";
}

function LoadCard({
  exercise,
  compact = false,
  onAdjust,
  onSet,
}: {
  exercise: RunnerExercise;
  compact?: boolean;
  onAdjust: (delta: number) => void;
  onSet: (kg: number | null) => void;
}) {
  const workingSets = working(exercise);
  const target =
    workingSets.find((set) => !set.completed)?.targetKg ??
    workingSets[0]?.targetKg ??
    null;

  const [open, setOpen] = useState(() => weightMoved(exercise.action));

  if (exercise.family === "bodyweight") {
    return (
      <Card className="p-5">
        <p className="label">
          {exercise.isTimed ? "Isometria" : "Peso do corpo"}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {exercise.reason}
        </p>
      </Card>
    );
  }

  const plates = target !== null && target > 0 ? platesForWeight(target) : null;
  const arrow =
    exercise.action === "increase"
      ? "↑"
      : exercise.action === "deload"
        ? "↓"
        : null;

  const weight = (
    <span
      className={cx(
        "tabular font-[family-name:var(--font-display)]",
        compact ? "text-4xl" : "text-5xl",
      )}
    >
      {arrow ? (
        <span className="mr-1 align-middle text-2xl text-brass" aria-hidden="true">
          {arrow}
        </span>
      ) : null}
      {target === null ? "—" : target}
      <span className="ml-1 text-lg text-muted">kg</span>
    </span>
  );

  const weightField = (
    <span className="flex items-baseline gap-1">
      <NumericInput
        decimal
        value={target}
        onChange={onSet}
        aria-label="Carga em quilos"
        className={cx(
          "border-transparent bg-transparent font-[family-name:var(--font-display)]",
          compact ? "h-12 w-24 text-4xl" : "h-14 w-28 text-5xl",
        )}
      />
      <span className="text-lg text-muted">kg</span>
    </span>
  );

  if (!open) {
    return (
      <Card>
        <button
          onClick={() => setOpen(true)}
          aria-expanded={false}
          className="flex w-full items-center justify-between gap-4 px-5 py-3 text-left"
        >
          <span className="label">Carga</span>
          {weight}
          <span className="text-xs uppercase tracking-[0.14em] text-brass">
            Ajustar
          </span>
        </button>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="label">Carga de trabalho</p>
        <button
          onClick={() => setOpen(false)}
          aria-expanded
          className="text-xs uppercase tracking-[0.14em] text-faint"
        >
          Fechar
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <Button
          variant="quiet"
          size={compact ? "md" : "lg"}
          aria-label="Reduzir a carga"
          onClick={() => onAdjust(-exercise.increment)}
          className="w-14"
        >
          −
        </Button>
        {weightField}
        <Button
          variant="quiet"
          size={compact ? "md" : "lg"}
          aria-label="Aumentar a carga"
          onClick={() => onAdjust(exercise.increment)}
          className="w-14"
        >
          +
        </Button>
      </div>

      <p className="mt-1 text-center text-xs text-faint">
        Toca no número para escrever a carga exata.
      </p>

      <p className="mt-3 text-sm leading-relaxed text-muted">{exercise.reason}</p>

      {plates?.loadable && plates.perSide.length > 0 ? (
        <p className="mt-2 text-xs text-faint">
          Por lado: {plates.perSide.join(" + ")} kg numa barra de {plates.barKg}{" "}
          kg
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-faint">
        {exercise.last ? (
          <span>
            Da última vez: {exercise.last.weightKg ?? "—"} kg ×{" "}
            {exercise.last.reps ?? "—"} em {exercise.last.on}
          </span>
        ) : (
          <span>Ainda sem histórico</span>
        )}
        {exercise.partner ? (
          <span>
            {exercise.partner.name ?? "Parceiro"}:{" "}
            {exercise.partner.weightKg ?? "—"} kg
          </span>
        ) : null}
      </div>
    </Card>
  );
}

/**
 * The target for the sets still to come. Loads have had a ± since the start;
 * repetitions only had whatever the programme said, so raising the number
 * meant typing it into every row by hand.
 */
function RepsCard({
  exercise,
  target,
  onAdjust,
}: {
  exercise: RunnerExercise;
  target: number;
  onAdjust: (delta: number) => void;
}) {
  const step = exercise.isTimed ? 5 : exercise.perSide ? 2 : 1;

  return (
    <Card className="flex items-center justify-between gap-3 py-2 pl-5 pr-2">
      <div>
        <p className="label">{exercise.isTimed ? "Tempo" : "Repetições"}</p>
        <p className="mt-0.5 text-xs text-faint">
          {exercise.isTimed
            ? "Por série, em segundos"
            : exercise.perSide
              ? "Por série, total dos dois lados"
              : "Por série"}
        </p>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="quiet"
          aria-label={exercise.isTimed ? "Menos tempo" : "Menos repetições"}
          onClick={() => onAdjust(-step)}
          className="w-12"
        >
          −
        </Button>
        <p className="tabular w-14 text-center font-[family-name:var(--font-display)] text-3xl">
          {target}
        </p>
        <Button
          variant="quiet"
          aria-label={exercise.isTimed ? "Mais tempo" : "Mais repetições"}
          onClick={() => onAdjust(step)}
          className="w-12"
        >
          +
        </Button>
      </div>
    </Card>
  );
}

/* ---------------------------------------------------------- body weight */

const weightInitial: BodyLogState = { error: null, saved: false };

function BodyWeightSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="quiet" size="field" disabled={pending}>
      {pending ? "A guardar…" : "Registar"}
    </Button>
  );
}

/**
 * Asked once at the start of a session, where the answer costs one tap and the
 * body-weight chart stops having holes in it.
 */
function BodyWeightPrompt() {
  const [state, formAction] = useActionState(logBodyWeight, weightInitial);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || state.saved) return null;

  return (
    <Card className="p-5">
      <p className="label">Antes de começar</p>
      <p className="mt-2 text-sm text-muted">Ainda não te pesaste hoje.</p>
      <form action={formAction} className="mt-4 space-y-3">
        <Field
          label="Peso"
          name="weight_kg"
          type="number"
          step="0.1"
          inputMode="decimal"
          suffix="kg"
          required
          action={<BodyWeightSubmit />}
        />
        {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      </form>
      <button
        onClick={() => setDismissed(true)}
        className="mt-3 text-xs uppercase tracking-[0.14em] text-faint"
      >
        Agora não
      </button>
    </Card>
  );
}

/* ----------------------------------------------------------------- sets */

function SetRow({
  set,
  label,
  repTarget,
  bodyweight,
  timed,
  perSide,
  onToggle,
  onReps,
}: {
  set: RunnerSet;
  label?: string;
  repTarget: number | null;
  bodyweight: boolean;
  timed: boolean;
  perSide: boolean;
  onToggle: () => void;
  onReps: (reps: number | null) => void;
}) {
  const [elapsed, setElapsed] = useState<number | null>(null);
  const weight = set.weightKg ?? set.targetKg;
  const split = perSide ? perSideLabel(set.reps) : null;

  // The work timer counts the hold itself, which is a different thing from the
  // rest timer: stopping it writes the seconds you actually held.
  useEffect(() => {
    if (elapsed === null) return;
    const timer = window.setTimeout(
      () => setElapsed((value) => (value ?? 0) + 1),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [elapsed]);

  const stopTimer = () => {
    if (elapsed !== null && elapsed > 0) onReps(elapsed);
    setElapsed(null);
  };

  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="tabular w-6 text-sm text-faint">{set.setNo}</span>

        {label ? (
          <span className="w-24 shrink-0 truncate text-xs text-muted">
            {label}
          </span>
        ) : null}

        {!bodyweight ? (
          <span className="tabular w-20 text-sm">
            {weight === null ? "—" : `${weight} kg`}
          </span>
        ) : null}

        <label className="flex flex-1 items-center gap-2">
          <span className="sr-only">{timed ? "Segundos" : "Repetições"}</span>
          <NumericInput
            value={elapsed !== null ? elapsed : set.reps}
            placeholder={repTarget !== null ? String(repTarget) : "—"}
            readOnly={elapsed !== null}
            onChange={onReps}
            className="h-11 w-16 px-2"
          />
          <span className="text-xs text-faint">{timed ? "s" : "reps"}</span>
        </label>

        {timed ? (
          <button
            onClick={() => (elapsed === null ? setElapsed(0) : stopTimer())}
            className={cx(
              "h-11 w-20 shrink-0 rounded-[var(--radius-md)] border text-xs uppercase tracking-[0.14em]",
              elapsed === null
                ? "border-line-strong text-muted"
                : "border-brass text-brass",
            )}
          >
            {elapsed === null ? "Contar" : "Parar"}
          </button>
        ) : null}

        <button
          onClick={onToggle}
          aria-pressed={set.completed}
          aria-label={set.completed ? "Marcar como não feita" : "Marcar como feita"}
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
            aria-hidden="true"
            className="fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:2]"
          >
            <path d="M4 12.5l5 5L20 7" />
          </svg>
        </button>
      </div>

      {perSide ? (
        <p className="mt-1 h-4 pl-9 text-xs text-faint">{split}</p>
      ) : null}
    </div>
  );
}
