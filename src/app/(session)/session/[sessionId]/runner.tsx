"use client";

import Image from "next/image";
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
import { Sheet } from "@/components/sheet";
import {
  formatRepTarget,
  perSideLabel,
  platesForWeight,
} from "@/lib/progression";
import { useWakeLock } from "@/lib/use-wake-lock";
import { useOfflineQueue } from "@/lib/use-offline-queue";
import type { PendingSet } from "@/lib/offline-queue";
import type { LiftFamily } from "@/lib/database.types";
import { logBodyWeight, type BodyLogState } from "@/app/(app)/progress/actions";
import {
  abandonSession,
  addExerciseToSession,
  finishSession,
  logSet,
  removeExerciseFromSession,
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
  family: LiftFamily;
  increment: number;
  repLow: number;
  repHigh: number;
  restSec: number;
  notes: string | null;
  addedMidSession: boolean;
  isTimed: boolean;
  perSide: boolean;
  reason: string;
  last: { weightKg: number | null; reps: number | null; on: string } | null;
  partner: { name: string | null; weightKg: number | null; reps: number | null } | null;
  sets: RunnerSet[];
};

export type CatalogueOption = {
  slug: string;
  name: string;
  muscle: string;
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
  available,
  needsBodyWeight,
}: {
  sessionId: string;
  dayName: string;
  focus: string | null;
  exercises: RunnerExercise[];
  available: CatalogueOption[];
  needsBodyWeight: boolean;
}) {
  const router = useRouter();
  const [exercises, setExercises] = useState(initial);
  const [index, setIndex] = useState(0);
  const [showDemo, setShowDemo] = useState(false);
  const [rest, setRest] = useState<number | null>(null);
  const [adjusting, setAdjusting] = useState(false);
  const [search, setSearch] = useState("");
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

  // The server owns the exercise list: adding or dropping one refreshes the
  // route and the new prescription arrives as a prop.
  useEffect(() => {
    setExercises(initial);
    setIndex((current) => Math.min(current, Math.max(initial.length - 1, 0)));
  }, [initial]);

  const exercise = exercises[index];
  const isLast = index === exercises.length - 1;
  const isBodyweight = exercise?.family === "bodyweight";

  const workingSets = useMemo(
    () => exercise?.sets.filter((set) => !set.isWarmup) ?? [],
    [exercise],
  );
  const warmups = useMemo(
    () => exercise?.sets.filter((set) => set.isWarmup) ?? [],
    [exercise],
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
    const timer = window.setTimeout(
      () => setRest((value) => (value ?? 1) - 1),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [rest]);

  /* ------------------------------------------------------------ actions */

  const patchSet = useCallback((setId: string, patch: Partial<RunnerSet>) => {
    setExercises((current) =>
      current.map((item) => ({
        ...item,
        sets: item.sets.map((set) =>
          set.id === setId ? { ...set, ...patch } : set,
        ),
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
    [exercise, patchSet, persist],
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
  }, []);

  const addExercise = useCallback(
    (slug: string) => {
      setMutation(null);
      startTransition(async () => {
        const result = await addExerciseToSession({ sessionId, exercise: slug });
        if (!result.ok) {
          setMutation(result.error);
          return;
        }
        setSearch("");
        setAdjusting(false);
        router.refresh();
      });
    },
    [router, sessionId],
  );

  const removeExercise = useCallback(
    (slug: string) => {
      setMutation(null);
      startTransition(async () => {
        const result = await removeExerciseFromSession({
          sessionId,
          exercise: slug,
        });
        if (!result.ok) {
          setMutation(result.error);
          return;
        }
        router.refresh();
      });
    },
    [router, sessionId],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const list = needle
      ? available.filter(
          (option) =>
            option.name.toLowerCase().includes(needle) ||
            option.muscle.toLowerCase().includes(needle),
        )
      : available;
    return list.slice(0, 40);
  }, [available, search]);

  if (!exercise) return null;

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
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="label">{dayName}</p>
            <p className="text-xs text-faint">{focus}</p>
          </div>
          <div className="flex items-center gap-4">
            {!queue.online || queue.pending > 0 ? (
              <span
                className={cx(
                  "rounded-full border px-2 py-0.5 text-[0.625rem] uppercase tracking-[0.14em]",
                  queue.online
                    ? "border-brass-dim text-brass-dim"
                    : "border-line-strong text-faint",
                )}
              >
                {queue.online
                  ? `${queue.pending} por enviar`
                  : "Sem rede"}
              </span>
            ) : null}
            <button
              onClick={() => setAdjusting(true)}
              className="text-xs uppercase tracking-[0.14em] text-brass"
            >
              Ajustar
            </button>
            <form action={abandonSession}>
              <input type="hidden" name="session_id" value={sessionId} />
              <button
                type="submit"
                className="text-xs uppercase tracking-[0.14em] text-faint"
              >
                Abandonar
              </button>
            </form>
          </div>
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
          {needsBodyWeight && index === 0 ? <BodyWeightPrompt /> : null}

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
            onClick={() => setShowDemo((value) => !value)}
            className="text-sm text-brass underline underline-offset-4"
          >
            {showDemo ? "Esconder a técnica" : "Como se faz"}
          </button>

          {showDemo ? (
            <Card className="overflow-hidden">
              <div className="grid grid-cols-2 gap-px bg-line">
                {exercise.images.slice(0, 2).map((src, imageIndex) => (
                  <Image
                    key={src}
                    src={src}
                    alt={`${exercise.name}, posição ${imageIndex + 1}`}
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
              <p className="label">
                {exercise.isTimed ? "Isometria" : "Peso do corpo"}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {exercise.reason}
              </p>
            </Card>
          ) : (
            <Card className="p-5">
              <p className="label">Carga de trabalho</p>
              <div className="mt-3 flex items-center justify-between gap-4">
                <Button
                  variant="quiet"
                  size="lg"
                  aria-label="Reduzir a carga"
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
                  aria-label="Aumentar a carga"
                  onClick={() => adjustTarget(exercise.increment)}
                  className="w-14"
                >
                  +
                </Button>
              </div>

              <p className="mt-3 text-sm leading-relaxed text-muted">
                {exercise.reason}
              </p>

              {plates?.loadable && plates.perSide.length > 0 ? (
                <p className="mt-2 text-xs text-faint">
                  Por lado: {plates.perSide.join(" + ")} kg numa barra de{" "}
                  {plates.barKg} kg
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
          )}

          {/* ------------------------------------------------- sets */}
          {warmups.length > 0 ? (
            <section>
              <p className="label mb-2">Aquecimento</p>
              <Card className="divide-y divide-line">
                {warmups.map((set) => (
                  <SetRow
                    key={set.id}
                    set={set}
                    repTarget={null}
                    bodyweight={isBodyweight}
                    timed={exercise.isTimed}
                    perSide={exercise.perSide}
                    onToggle={() => toggleSet(set)}
                    onReps={(reps) => changeReps(set, reps)}
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
                  repTarget={exercise.repLow}
                  bodyweight={isBodyweight}
                  timed={exercise.isTimed}
                  perSide={exercise.perSide}
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
            {completedCount} de {exercises.length} feitos
          </span>
          {isLast ? (
            <form action={finishSession} ref={finishForm}>
              <input type="hidden" name="session_id" value={sessionId} />
              <Button
                type="button"
                className="w-28"
                onClick={async () => {
                  // Nothing is lost by finishing with sets still queued, but
                  // the progression would be computed without them.
                  const left = await queue.flush();
                  if (left > 0) {
                    setMutation(
                      "Há séries ainda por enviar. Liga-te à rede antes de terminar.",
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

          <section>
            <p className="label mb-2">Exercícios de hoje</p>
            <ul className="divide-y divide-line rounded-[var(--radius-md)] border border-line">
              {exercises.map((item) => (
                <li
                  key={item.slug}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <span className="text-sm">{item.name}</span>
                  <button
                    onClick={() => removeExercise(item.slug)}
                    disabled={pending || exercises.length <= 1}
                    className="text-xs uppercase tracking-[0.14em] text-oxblood disabled:opacity-40"
                  >
                    Remover
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="pb-2">
            <p className="label mb-2">Adicionar exercício</p>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Procurar por nome ou músculo"
              className="mb-3 h-12 w-full rounded-[var(--radius-md)] border border-line bg-raised px-3 placeholder:text-faint focus:border-brass focus:outline-none"
            />
            <ul className="divide-y divide-line rounded-[var(--radius-md)] border border-line">
              {filtered.map((option) => (
                <li key={option.slug}>
                  <button
                    onClick={() => addExercise(option.slug)}
                    disabled={pending}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left disabled:opacity-40"
                  >
                    <span className="text-sm">{option.name}</span>
                    <span className="text-xs text-faint">{option.muscle}</span>
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
        </div>
      </Sheet>
    </div>
  );
}

/* ---------------------------------------------------------- body weight */

const weightInitial: BodyLogState = { error: null, saved: false };

function BodyWeightSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="quiet" disabled={pending}>
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
      <p className="mt-2 text-sm text-muted">
        Ainda não registaste o peso hoje.
      </p>
      <form action={formAction} className="mt-4 space-y-3">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Field
              label="Peso"
              name="weight_kg"
              type="number"
              step="0.1"
              inputMode="decimal"
              suffix="kg"
              required
            />
          </div>
          <BodyWeightSubmit />
        </div>
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
  repTarget,
  bodyweight,
  timed,
  perSide,
  onToggle,
  onReps,
}: {
  set: RunnerSet;
  repTarget: number | null;
  bodyweight: boolean;
  timed: boolean;
  perSide: boolean;
  onToggle: () => void;
  onReps: (reps: number) => void;
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

        {!bodyweight ? (
          <span className="tabular w-20 text-sm">
            {weight === null ? "—" : `${weight} kg`}
          </span>
        ) : null}

        <label className="flex flex-1 items-center gap-2">
          <span className="sr-only">{timed ? "Segundos" : "Repetições"}</span>
          <input
            type="number"
            inputMode="numeric"
            step={perSide ? 2 : 1}
            value={elapsed !== null ? elapsed : (set.reps ?? "")}
            placeholder={repTarget !== null ? String(repTarget) : "—"}
            readOnly={elapsed !== null}
            onChange={(event) => onReps(Number(event.target.value))}
            className="tabular h-10 w-16 rounded-[var(--radius-sm)] border border-line bg-surface px-2 text-center focus:border-brass focus:outline-none"
          />
          <span className="text-xs text-faint">{timed ? "s" : "reps"}</span>
        </label>

        {timed ? (
          <button
            onClick={() => (elapsed === null ? setElapsed(0) : stopTimer())}
            className={cx(
              "h-11 rounded-[var(--radius-md)] border px-3 text-xs uppercase tracking-[0.14em]",
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

      {split ? (
        <p className="mt-1 pl-9 text-xs text-faint">{split}</p>
      ) : null}
    </div>
  );
}
