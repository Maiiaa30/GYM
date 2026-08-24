import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/* ---------------------------------------------------------------- Button */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "quiet" | "ghost" | "danger";
  size?: "md" | "field" | "lg";
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] " +
    "border font-medium tracking-wide transition-colors duration-150 " +
    "disabled:opacity-40 disabled:pointer-events-none select-none";

  const sizes = {
    md: "h-11 px-4 text-sm",
    // Matches the height of a Field's input, for buttons that sit beside one.
    field: "h-12 px-4 text-sm",
    lg: "h-14 px-5 text-base",
  }[size];

  const variants = {
    primary:
      "border-brass bg-brass text-ink hover:bg-brass-dim hover:border-brass-dim active:bg-brass-dim",
    quiet:
      "border-line-strong bg-raised text-parchment hover:border-brass hover:text-brass",
    ghost: "border-transparent bg-transparent text-muted hover:text-parchment",
    danger:
      "border-oxblood bg-transparent text-oxblood hover:bg-oxblood hover:text-parchment",
  }[variant];

  return <button className={cx(base, sizes, variants, className)} {...props} />;
}

/* ----------------------------------------------------------------- Field */

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  suffix?: string;
  /** A button that belongs on the same line as the input, e.g. "Registar". */
  action?: ReactNode;
};

/**
 * A labelled input.
 *
 * When an `action` is given it sits on the input's own line, so the button
 * lines up with the box rather than with whatever happens to be underneath it.
 * Putting the button beside the whole field instead — as the weight and goal
 * forms did — aligned it to the bottom of the hint text, which left it hanging
 * below the input.
 *
 * The wrapper is a `<label>` only when there is no action: a submit button
 * inside a label has the label's activation behaviour applied to it.
 */
export function Field({
  label,
  hint,
  suffix,
  action,
  className,
  ...props
}: FieldProps) {
  const input = (
    <span className="relative block min-w-0 flex-1">
      <input
        id={props.id ?? (typeof props.name === "string" ? props.name : undefined)}
        className={cx(
          "w-full h-12 rounded-[var(--radius-md)] border border-line bg-surface",
          "px-3 text-parchment placeholder:text-faint",
          "focus:border-brass focus:outline-none",
          suffix && "pr-12",
          className,
        )}
        {...props}
      />
      {suffix ? (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-faint">
          {suffix}
        </span>
      ) : null}
    </span>
  );

  const caption = hint ? (
    <span className="mt-1.5 block text-xs leading-relaxed text-faint">
      {hint}
    </span>
  ) : null;

  if (!action) {
    return (
      <label className="block">
        <span className="label block mb-2">{label}</span>
        {input}
        {caption}
      </label>
    );
  }

  const id = props.id ?? (typeof props.name === "string" ? props.name : undefined);

  return (
    <div className="block">
      <label htmlFor={id} className="label block mb-2">
        {label}
      </label>
      <span className="flex items-stretch gap-2">
        {input}
        {action}
      </span>
      {caption}
    </div>
  );
}

/* ------------------------------------------------------------------ Card */

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "rounded-[var(--radius-lg)] border border-line bg-surface",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ----------------------------------------------------------------- Panel */

/**
 * One rhythm for every card on a reading screen: a label, optional figure on
 * the right, the content, and an optional line of explanation underneath.
 *
 * The progress screens grew each card its own padding and its own idea of
 * where a heading goes, which is what made them read as noise. Content that
 * has to reach the card's edge — a scrolling grid, a divided list — cancels
 * the padding with `-mx-5`.
 */
export function Panel({
  title,
  meta,
  note,
  children,
}: {
  title: string;
  meta?: ReactNode;
  note?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="label">{title}</p>
        {meta ? (
          <p className="tabular shrink-0 text-xs text-faint">{meta}</p>
        ) : null}
      </div>

      <div className="mt-4">{children}</div>

      {note ? (
        <p className="mt-3 text-xs leading-relaxed text-faint">{note}</p>
      ) : null}
    </Card>
  );
}

/* --------------------------------------------------------------- Notices */

export function Notice({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "error";
  children: ReactNode;
}) {
  return (
    <p
      role={tone === "error" ? "alert" : undefined}
      className={cx(
        "rounded-[var(--radius-md)] border px-3 py-2.5 text-sm",
        tone === "error"
          ? "border-oxblood/60 text-oxblood"
          : "border-line text-muted",
      )}
    >
      {children}
    </p>
  );
}

/* ------------------------------------------------------------- Wordmark */

export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cx(
        "font-[family-name:var(--font-display)] text-2xl tracking-[0.3em] text-parchment",
        className,
      )}
    >
      GYM
    </span>
  );
}
