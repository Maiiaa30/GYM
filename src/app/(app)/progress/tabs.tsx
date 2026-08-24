"use client";

import { useState } from "react";
import { cx } from "@/components/ui";

const TABS = ["Peso", "Atividade", "Músculos", "Força"] as const;

/**
 * Four readings of the same history, one screen each. The sections arrive
 * already rendered from the server, so switching between them costs nothing
 * and none of the chart work reaches the browser.
 */
export function ProgressTabs({
  weight,
  activity,
  muscles,
  strength,
}: {
  weight: React.ReactNode;
  activity: React.ReactNode;
  muscles: React.ReactNode;
  strength: React.ReactNode;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Peso");
  const panels = { Peso: weight, Atividade: activity, Músculos: muscles, Força: strength };

  return (
    <div className="space-y-5">
      {/* Sentence case and no extra letter-spacing: uppercase with tracking
          made "Atividade" fill its whole slot, so the four labels ran into one
          another. The row is also a full 44 px tall, which it was not. */}
      <div
        role="tablist"
        aria-label="Vistas do progresso"
        className="flex gap-1 rounded-[var(--radius-md)] border border-line p-1"
      >
        {TABS.map((name) => (
          <button
            key={name}
            role="tab"
            aria-selected={tab === name}
            onClick={() => setTab(name)}
            className={cx(
              "flex h-11 flex-1 items-center justify-center rounded-[var(--radius-sm)]",
              "px-1 text-[0.8125rem] transition-colors",
              tab === name
                ? "bg-raised font-medium text-brass"
                : "text-muted",
            )}
          >
            {name}
          </button>
        ))}
      </div>

      <div role="tabpanel">{panels[tab]}</div>
    </div>
  );
}
