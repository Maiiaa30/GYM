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
    <div>
      {/*
        The selected tab is marked by a rule on the section's own hairline,
        the same mark the bottom navigation uses — one idea of "you are here"
        for the whole application rather than one per bar.

        Condensed uppercase is what makes the four labels fit: "Atividade" and
        "Progresso" ran into their neighbours in the body face, which is why
        this row used to be sentence case with no tracking.
      */}
      <div
        role="tablist"
        aria-label="Vistas do progresso"
        className="grid grid-cols-4 gutter-x border-b border-line"
      >
        {TABS.map((name) => (
          <button
            key={name}
            role="tab"
            aria-selected={tab === name}
            onClick={() => setTab(name)}
            className={cx(
              "flex h-12 min-w-0 items-center justify-center transition-colors",
              "font-[family-name:var(--font-display)] text-base uppercase tracking-[0.08em]",
              tab === name
                ? "-mb-px border-b-2 border-amber font-bold text-amber"
                : "font-semibold text-faint",
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
