"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

const ITEMS = [
  { href: "/", label: "Today", icon: TodayIcon },
  { href: "/plan", label: "Plan", icon: PlanIcon },
  { href: "/progress", label: "Progress", icon: ProgressIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
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

/* Line icons, 1px strokes, no fills. */

function svgProps() {
  return {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.25,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
}

function TodayIcon() {
  return (
    <svg {...svgProps()}>
      <path d="M3 12h2M19 12h2M7 8v8M17 8v8" />
      <rect x="7" y="9.5" width="10" height="5" rx="1" />
    </svg>
  );
}

function PlanIcon() {
  return (
    <svg {...svgProps()}>
      <rect x="4" y="4" width="16" height="16" rx="1.5" />
      <path d="M4 9h16M9 9v11" />
    </svg>
  );
}

function ProgressIcon() {
  return (
    <svg {...svgProps()}>
      <path d="M4 19V5M4 19h16" />
      <path d="M7 15l4-5 3 3 4-6" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg {...svgProps()}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" />
    </svg>
  );
}
