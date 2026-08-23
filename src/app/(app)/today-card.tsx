"use client";

import { useState } from "react";
import { Button, Card } from "@/components/ui";
import { Sheet } from "@/components/sheet";
import { startSession } from "../(session)/session/actions";

export type TodayDay = {
  id: string;
  name: string;
  focus: string | null;
  items: Array<{ name: string; sets: number; repLow: number; repHigh: number }>;
};

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
        <div className="flex items-baseline justify-between px-5 pt-5">
          <div>
            <p className="label">Hoje</p>
            <p className="mt-1 font-[family-name:var(--font-display)] text-3xl">
              {day.name}
            </p>
          </div>
          <p className="text-xs text-faint">{day.focus}</p>
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
            <Button type="submit" size="lg" className="w-full">
              Começar o treino
            </Button>
          </form>

          {days.length > 1 ? (
            <button
              onClick={() => setPicking(true)}
              className="w-full text-center text-xs uppercase tracking-[0.14em] text-faint"
            >
              Treinar outro dia
            </button>
          ) : null}
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
