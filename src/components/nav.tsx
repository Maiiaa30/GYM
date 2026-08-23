"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

const ITEMS = [
  { href: "/", label: "Hoje", icon: DumbbellIcon },
  { href: "/plan", label: "Plano", icon: CalendarIcon },
  { href: "/progress", label: "Progresso", icon: ChartIcon },
  { href: "/settings", label: "Definições", icon: SlidersIcon },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="rule bg-ink"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex w-full max-w-md">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex h-16 flex-col items-center justify-center gap-1.5 transition-colors",
                  active ? "text-brass" : "text-faint",
                )}
              >
                <Icon />
                <span className="text-[0.625rem] uppercase tracking-[0.14em]">
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/* Line icons drawn on a 24 unit grid, 1.5 unit strokes, no fills. */

function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function DumbbellIcon() {
  return (
    <Svg>
      <path d="M3 10v4M21 10v4" />
      <rect x="5.5" y="7.5" width="3" height="9" rx="1" />
      <rect x="15.5" y="7.5" width="3" height="9" rx="1" />
      <path d="M8.5 12h7" />
    </Svg>
  );
}

function CalendarIcon() {
  return (
    <Svg>
      <rect x="3.5" y="5.5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17M8.5 3v4M15.5 3v4" />
    </Svg>
  );
}

function ChartIcon() {
  return (
    <Svg>
      <path d="M4 4v16h16" />
      <path d="M8.5 17v-4M13 17V9M17.5 17v-6" />
    </Svg>
  );
}

function SlidersIcon() {
  return (
    <Svg>
      <path d="M4 9h7M17 9h3M4 15h3M13 15h7" />
      <circle cx="14" cy="9" r="2.2" />
      <circle cx="10" cy="15" r="2.2" />
    </Svg>
  );
}
