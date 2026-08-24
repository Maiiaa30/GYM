"use client";

import { useState } from "react";
import { cx } from "@/components/ui";

const TABS = ["Peso", "Actividade", "Músculos", "Força"] as const;

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
  const panels = { Peso: weight, Actividade: activity, Músculos: muscles, Força: strength };

  return (
    <div className="space-y-5">
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
              "flex-1 rounded-[var(--radius-sm)] py-2 text-xs uppercase tracking-[0.1em] transition-colors",
              tab === name ? "bg-raised text-brass" : "text-faint",
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
