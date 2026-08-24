"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Card } from "@/components/ui";
import { Sheet } from "@/components/sheet";
import { formatMinutes } from "@/lib/duration";
import {
  startFreestyleSession,
  startSession,
} from "../(session)/session/actions";

export type TodayDay = {
  id: string;
  name: string;
  focus: string | null;
  minutes: number;
  items: Array<{ name: string; sets: number; repLow: number; repHigh: number }>;
};

/**
 * Starting a session writes several rows, which on a gym connection is not
 * instant. Without this the button looked dead and invited a second tap.
 */
function StartButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "A preparar…" : label}
    </Button>
  );
}

function QuietSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-11 items-center px-3 text-xs uppercase tracking-[0.14em] text-muted disabled:opacity-40"
    >
      {pending ? "A preparar…" : label}
    </button>
  );
}

/**
 * The day the rotation suggests is preselected, but a session missed, a busy
 * gym or a closed rack should not force the wrong workout: any day of the
 * block can be chosen without changing the programme.
 */
export function TodayCard({
  days,
  suggestedIndex,
}: {
  days: TodayDay[];
  suggestedIndex: number;
}) {
  const [index, setIndex] = useState(suggestedIndex);
  const [picking, setPicking] = useState(false);

  const day = days[index] ?? days[0];
  if (!day) return null;

  return (
    <>
      <Card>
        <div className="flex items-baseline justify-between gap-3 px-5 pt-5">
          <div>
            <p className="label">Hoje</p>
            <p className="mt-1 font-[family-name:var(--font-display)] text-3xl">
              {day.name}
            </p>
            <p className="mt-1 text-sm text-muted">{day.focus}</p>
          </div>
          <p className="tabular shrink-0 text-xs text-faint">
            {formatMinutes(day.minutes)}
          </p>
        </div>

        <ul className="mt-4 divide-y divide-line">
          {day.items.map((item, position) => (
            <li
              key={`${day.id}-${position}`}
              className="flex items-center justify-between px-5 py-3"
            >
              <span className="text-sm">{item.name}</span>
              <span className="tabular text-sm text-muted">
                {item.sets} ×{" "}
                {item.repLow === item.repHigh
                  ? item.repLow
                  : `${item.repLow}–${item.repHigh}`}
              </span>
            </li>
          ))}
        </ul>

        <div className="space-y-3 p-5">
          <form action={startSession}>
            <input type="hidden" name="plan_day_id" value={day.id} />
            <StartButton label="Começar o treino" />
          </form>

          <div className="flex items-center justify-center gap-2">
            {days.length > 1 ? (
              <button
                onClick={() => setPicking(true)}
                className="flex h-11 items-center px-3 text-xs uppercase tracking-[0.14em] text-muted"
              >
                Treinar outro dia
              </button>
            ) : null}
            <form action={startFreestyleSession}>
              <QuietSubmit label="Treino livre" />
            </form>
          </div>
        </div>
      </Card>

      <Sheet
        open={picking}
        title="Escolher o treino"
        onClose={() => setPicking(false)}
      >
        <ul className="divide-y divide-line">
          {days.map((option, optionIndex) => (
            <li key={option.id}>
              <button
                onClick={() => {
                  setIndex(optionIndex);
                  setPicking(false);
                }}
                className="flex w-full items-baseline justify-between gap-3 px-5 py-4 text-left"
              >
                <span>
                  <span className="block text-base">{option.name}</span>
                  <span className="block text-xs text-faint">
                    {option.focus}
                    {option.focus ? " · " : ""}
                    {formatMinutes(option.minutes)}
                  </span>
                </span>
                {optionIndex === index ? (
                  <span className="label text-brass">Escolhido</span>
                ) : optionIndex === suggestedIndex ? (
                  <span className="label">Sugerido</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}
