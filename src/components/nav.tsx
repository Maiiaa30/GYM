"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

const ITEMS = [
  { href: "/", label: "Hoje" },
  { href: "/plan", label: "Plano" },
  { href: "/progress", label: "Progresso" },
  { href: "/settings", label: "Definições" },
];

/**
 * Four words and a rule. The icons went: a dumbbell, a calendar, a chart and a
 * slider are four drawings of roughly equal weight, and at 22px none of them
 * said anything the word underneath had not already said — they were costing a
 * third of the bar's height to repeat it.
 *
 * The active tab is marked by a 2px amber rule sitting on the bar's own
 * hairline (hence the -1px), not by a filled pill: the mark belongs to the
 * edge of the screen, so it reads without competing with the amber of the
 * primary action just above it.
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="rule bg-ink"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.75rem)" }}
    >
      <ul className="mx-auto grid w-full max-w-md grid-cols-4">
        {ITEMS.map(({ href, label }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex h-[52px] items-center justify-center transition-colors",
                  "font-[family-name:var(--font-display)] text-base uppercase tracking-[0.08em]",
                  active
                    ? "-mt-px border-t-2 border-amber font-bold text-amber"
                    : "font-semibold text-faint",
                )}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
