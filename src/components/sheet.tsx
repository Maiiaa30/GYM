"use client";

import { useEffect } from "react";
import { cx } from "@/components/ui";

/**
 * A panel that slides up from the bottom of the screen.
 *
 * Small decisions during a session — choosing an exercise, picking a different
 * training day — happen here rather than on a new page: the context behind
 * stays visible and everything is within reach of a thumb.
 */
export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 bg-ink/80"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          "relative flex max-h-[85dvh] flex-col rounded-t-[var(--radius-lg)]",
          "border-t border-line-strong bg-surface",
        )}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-center justify-between px-5 pb-3 pt-4">
          <p className="label">{title}</p>
          <button
            onClick={onClose}
            className="text-xs uppercase tracking-[0.14em] text-faint"
          >
            Fechar
          </button>
        </div>
        <div className="scroll-area rule pb-4">{children}</div>
      </div>
    </div>
  );
}
