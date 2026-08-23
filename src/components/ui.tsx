import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/* ---------------------------------------------------------------- Button */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "quiet" | "ghost" | "danger";
  size?: "md" | "lg";
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
};

export function Field({ label, hint, suffix, className, ...props }: FieldProps) {
  return (
    <label className="block">
      <span className="label block mb-2">{label}</span>
      <span className="relative block">
        <input
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
      {hint ? <span className="mt-1.5 block text-xs text-faint">{hint}</span> : null}
    </label>
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
