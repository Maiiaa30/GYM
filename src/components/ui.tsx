import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/* ---------------------------------------------------------------- Button */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "quiet" | "ghost" | "danger" | "tempo";
  size?: "md" | "field" | "lg";
};

/**
 * Squared, condensed, uppercase. The primary variant is a solid block of amber
 * with ink text — at 56px it is the only thing on the screen shaped like that,
 * which is what makes it findable with one thumb without hunting.
 *
 * `tempo` exists for the rest clock's own controls and nowhere else. Giving
 * skipping a rest the same amber as starting a workout made the two read as
 * the same weight of decision, and they are not.
 */
export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonProps) {
  const base =
    // No font-weight here: the size sets it, and two font-weight utilities on
    // one element resolve by their order in the stylesheet rather than by the
    // order they are written in, so the size would not reliably win.
    "inline-flex items-center justify-center gap-2 border select-none " +
    "font-[family-name:var(--font-display)] uppercase " +
    "tracking-[0.08em] transition-colors duration-150 " +
    "disabled:opacity-40 disabled:pointer-events-none";

  const sizes = {
    md: "h-11 px-4 text-base font-semibold",
    // Matches the height of a Field's input, for buttons that sit beside one.
    field: "h-12 px-4 text-base font-semibold",
    lg: "h-14 px-5 text-[1.4375rem] font-bold",
  }[size];

  const variants = {
    primary:
      "border-amber bg-amber text-ink hover:bg-amber-dim hover:border-amber-dim active:bg-amber-dim",
    quiet:
      "border-line-bright bg-transparent text-parchment hover:border-amber hover:text-amber",
    ghost: "border-transparent bg-transparent text-faint hover:text-parchment",
    danger:
      "border-oxblood bg-transparent text-oxblood hover:bg-oxblood hover:text-ink",
    tempo: "border-tempo bg-tempo text-ink hover:opacity-90",
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
          "w-full h-12 border border-line-strong bg-surface tabular",
          "px-3 text-parchment placeholder:text-faint",
          "focus:border-amber focus:outline-none",
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

/* ---------------------------------------------------------------- Section */

/**
 * A full-width band of the plate, divided from the next one by a single
 * hairline with the gutter's worth of air on each side of it — 44px between
 * two sections, which is the whole of the separation. There is no border, no
 * radius and no second ground: a card drawn inside a dark screen is one more
 * edge to read, and the screens that needed the most reading had the most of
 * them.
 *
 * `flush` cancels the horizontal padding for content that has to reach the
 * edge — a divided list, a scrolling grid, a chart.
 */
export function Section({
  children,
  className,
  flush = false,
  last = false,
}: {
  children: ReactNode;
  className?: string;
  flush?: boolean;
  last?: boolean;
}) {
  return (
    <section
      className={cx(
        flush ? "py-[var(--gutter)]" : "gutter",
        !last && "border-b border-line",
        className,
      )}
    >
      {children}
    </section>
  );
}

/**
 * Kept so the screens that have not been reworked still compile and still look
 * deliberate. It is the same band, boxed — new work should reach for
 * `Section`.
 */
export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("border border-line bg-surface", className)}>
      {children}
    </div>
  );
}

/**
 * A statistic: its name in small condensed capitals, then the number large
 * enough to be the thing you actually see. `unit` rides on the number's
 * baseline rather than sitting on its own line, so a column of these keeps one
 * rhythm whether or not the value carries a unit.
 */
export function Stat({
  label,
  value,
  unit,
  note,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  note?: ReactNode;
  tone?: "neutral" | "amber";
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="label-sm">{label}</p>
      <p className="display text-[2rem] text-parchment">
        {value}
        {unit ? (
          <span className="ml-0.5 text-[0.9375rem] text-faint">{unit}</span>
        ) : null}
      </p>
      {note ? (
        <p
          className={cx(
            "text-[0.78125rem]",
            tone === "amber" ? "text-amber" : "text-muted",
          )}
        >
          {note}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Two or three statistics across, divided by the same hairline as everything
 * else. The divider is drawn on the children rather than with `divide-x` so a
 * row of two and a row of three share one implementation.
 */
export function StatGrid({
  children,
  columns = 3,
}: {
  children: ReactNode;
  columns?: 2 | 3;
}) {
  return (
    <div
      className={cx(
        "grid [&>*]:gutter [&>*:not(:last-child)]:border-r [&>*:not(:last-child)]:border-line",
        columns === 3 ? "grid-cols-3" : "grid-cols-2",
      )}
    >
      {children}
    </div>
  );
}

/* ----------------------------------------------------------------- Panel */

/**
 * One rhythm for every section on a reading screen: the label on its own line
 * with air under it, an optional figure opposite, the content, and an optional
 * line of explanation underneath.
 *
 * The label having its own line is the change that made these screens
 * scannable — pressed against the content it read as part of it.
 */
export function Panel({
  title,
  meta,
  note,
  children,
  flush = false,
  last = false,
}: {
  title: string;
  meta?: ReactNode;
  note?: ReactNode;
  children: ReactNode;
  flush?: boolean;
  last?: boolean;
}) {
  return (
    <Section last={last}>
      <div className={cx("flex items-baseline justify-between gap-3", flush && "gutter-x")}>
        <p className="label">{title}</p>
        {/* A bare string is the common case — a figure or a date — and it
            should not have to carry its own type styles at every call site.
            Anything richer (a link, a delta) is rendered as given. */}
        {typeof meta === "string" || typeof meta === "number" ? (
          <p className="tabular shrink-0 text-[0.78125rem] text-faint">{meta}</p>
        ) : meta ? (
          <div className="shrink-0">{meta}</div>
        ) : null}
      </div>

      <div className="mt-3.5">{children}</div>

      {note ? (
        <p
          className={cx(
            "mt-3 text-[0.84375rem] leading-relaxed text-muted",
            flush && "gutter-x",
          )}
        >
          {note}
        </p>
      ) : null}
    </Section>
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
        "border-l-[3px] bg-surface px-3.5 py-2.5 text-sm",
        tone === "error"
          ? "border-oxblood text-oxblood"
          : "border-line-bright text-muted",
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
        "display text-2xl tracking-[0.3em] text-parchment",
        className,
      )}
    >
      GYM
    </span>
  );
}
