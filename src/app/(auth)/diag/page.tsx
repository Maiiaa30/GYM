"use client";

import { useEffect, useState } from "react";

/**
 * Temporary. Reports what the phone actually gives the page, because the
 * navigation and the document share one background and a screenshot cannot
 * tell a tall navigation apart from a short web view painted behind.
 *
 * Delete this route once the bottom of the screen is settled.
 */
export default function DiagPage() {
  const [rows, setRows] = useState<Array<[string, string]>>([]);

  useEffect(() => {
    const probe = (side: "top" | "bottom") => {
      const el = document.createElement("div");
      el.style.cssText = `position:fixed;${side}:0;height:env(safe-area-inset-${side});width:1px`;
      document.body.appendChild(el);
      const value = getComputedStyle(el).height;
      el.remove();
      return value;
    };

    const nav = window.navigator as Navigator & { standalone?: boolean };

    setRows([
      ["standalone (iOS)", String(nav.standalone)],
      [
        "display-mode: standalone",
        String(window.matchMedia("(display-mode: standalone)").matches),
      ],
      ["safe-area-inset-top", probe("top")],
      ["safe-area-inset-bottom", probe("bottom")],
      ["window.innerHeight", String(window.innerHeight)],
      [
        "documentElement.clientHeight",
        String(document.documentElement.clientHeight),
      ],
      ["visualViewport.height", String(window.visualViewport?.height ?? "—")],
      ["screen.height", String(window.screen.height)],
      ["devicePixelRatio", String(window.devicePixelRatio)],
      ["body height", String(Math.round(document.body.getBoundingClientRect().height))],
    ]);
  }, []);

  return (
    <div className="grid h-full grid-rows-[1fr_auto]">
      <div className="scroll-area gutter">
        <h1 className="display text-2xl text-parchment">Diagnóstico</h1>
        <ul className="mt-4">
          {rows.map(([k, v]) => (
            <li key={k} className="row justify-between">
              <span className="text-xs text-faint">{k}</span>
              <span className="tabular text-sm text-amber">{v}</span>
            </li>
          ))}
        </ul>
      </div>

      {/*
        A stand-in for the real navigation, in a colour that cannot be confused
        with the ground. Whatever sits below the magenta bar in a screenshot is
        not the application: it is the phone.
      */}
      <nav
        className="rule"
        style={{
          background: "#ff00aa",
          paddingBottom: "max(env(safe-area-inset-bottom), 0.75rem)",
        }}
      >
        <ul className="grid grid-cols-4">
          {["Hoje", "Plano", "Progresso", "Definições"].map((label) => (
            <li
              key={label}
              className="flex h-[52px] items-center justify-center font-[family-name:var(--font-display)] text-base font-semibold uppercase tracking-[0.08em] text-ink"
            >
              {label}
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
