"use client";

import { useState } from "react";
import type { InputHTMLAttributes } from "react";
import { cx } from "@/components/ui";

/**
 * A number field that behaves like a field.
 *
 * `<input type="number">` bound to a controlled value cannot be emptied: React
 * puts the old number straight back, so clearing a 0 to type 10 left "010" and
 * there was no way out of it. This keeps whatever is being typed in local state
 * — including the empty string — and only re-syncs to the real value on blur.
 * Focusing selects the contents, because replacing the number is what you
 * almost always want mid-set.
 */
export function NumericInput({
  value,
  onChange,
  decimal = false,
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: number | null;
  onChange: (value: number | null) => void;
  decimal?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value === null ? "" : String(value));

  return (
    <input
      type="text"
      inputMode={decimal ? "decimal" : "numeric"}
      autoComplete="off"
      value={shown}
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => {
        const cleaned = decimal
          ? event.target.value.replace(",", ".").replace(/[^0-9.]/g, "")
          : event.target.value.replace(/[^0-9]/g, "");
        setDraft(cleaned);
        const parsed = Number(cleaned);
        onChange(cleaned === "" || Number.isNaN(parsed) ? null : parsed);
      }}
      onBlur={() => setDraft(null)}
      className={cx(
        "tabular rounded-[var(--radius-sm)] border border-line bg-surface",
        "text-center focus:border-brass focus:outline-none",
        className,
      )}
      {...props}
    />
  );
}
