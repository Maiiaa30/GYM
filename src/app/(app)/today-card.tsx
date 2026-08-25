"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Section } from "@/components/ui";
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
      className="action flex h-11 items-center px-3 text-muted disabled:opacity-40"
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
      <Section>
        {/*
          The day's name and the minutes it will take, on one line, because
          those are the two things being decided between: whether to go, and
          whether there is time. The minutes are set as large as the name so
          the answer to the second question is not small print.
        */}
        <div className="flex items-start justify-between gap-3.5">
          <div className="min-w-0 flex-1">
            <p className="label text-amber">Treino de hoje</p>
            <p className="display mt-2 text-[2.125rem] leading-[1.02] text-parchment">
              {day.name}
            </p>
            {day.focus ? (
              <p className="mt-1.5 text-sm text-muted">{day.focus}</p>
            ) : null}
          </div>
          <p className="shrink-0 text-right">
            <span className="display block text-[2.125rem] text-parchment">
              {day.minutes}
            </span>
            <span className="label-sm">min</span>
          </p>
        </div>

        <ul className="mt-4">
          {day.items.map((item, position) => (
            <li key={`${day.id}-${position}`} className="row">
              <span className="w-3 shrink-0 font-[family-name:var(--font-mono)] text-[0.625rem] text-faint">
                {position + 1}
              </span>
              <span className="min-w-0 flex-1 text-[0.9375rem] text-parchment">
                {item.name}
              </span>
              <span className="display shrink-0 text-[1.125rem] font-semibold text-muted">
                {item.sets} ×{" "}
                {item.repLow === item.repHigh
                  ? item.repLow
                  : `${item.repLow}–${item.repHigh}`}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-5 space-y-3">
          <form action={startSession}>
            <input type="hidden" name="plan_day_id" value={day.id} />
            <StartButton label="Começar o treino" />
          </form>

          <div className="flex items-center justify-center gap-2">
            {days.length > 1 ? (
              <button
                onClick={() => setPicking(true)}
                className="action flex h-11 items-center px-3 text-muted"
              >
                Treinar outro dia
              </button>
            ) : null}
            <form action={startFreestyleSession}>
              <QuietSubmit label="Treino livre" />
            </form>
          </div>
        </div>
      </Section>

      <Sheet
        open={picking}
        title="Escolher o treino"
        onClose={() => setPicking(false)}
      >
        <ul>
          {days.map((option, optionIndex) => (
            <li key={option.id} className="border-t border-line-inner">
              <button
                onClick={() => {
                  setIndex(optionIndex);
                  setPicking(false);
                }}
                className="flex min-h-14 w-full items-center justify-between gap-3 px-[var(--gutter)] py-3 text-left"
              >
                <span className="min-w-0">
                  <span className="display block text-[1.1875rem] text-parchment">
                    {option.name}
                  </span>
                  <span className="block text-xs text-faint">
                    {option.focus}
                    {option.focus ? " · " : ""}
                    {formatMinutes(option.minutes)}
                  </span>
                </span>
                {optionIndex === index ? (
                  <span className="label text-amber">Escolhido</span>
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
