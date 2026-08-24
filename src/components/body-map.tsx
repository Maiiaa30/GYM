/**
 * A stylised body read as two figures, front and back, with each region
 * shaded by how much work it received. Deliberately schematic rather than
 * anatomical: at the size of a phone the point is which areas are dark and
 * which are empty, not the shape of a muscle.
 */

const BRASS = "194, 164, 103";

function shade(share: number): string {
  if (share <= 0) return "rgba(255, 255, 255, 0.04)";
  return `rgba(${BRASS}, ${(0.15 + share * 0.8).toFixed(2)})`;
}

type Shares = Map<string, number>;

function fill(shares: Shares, muscle: string): string {
  return shade(shares.get(muscle) ?? 0);
}

const OUTLINE = "rgba(255, 255, 255, 0.10)";

export function BodyMap({ shares }: { shares: Shares }) {
  return (
    <div className="grid grid-cols-2 gap-2 px-5 py-4">
      <Figure title="Frente">
        <FrontBody shares={shares} />
      </Figure>
      <Figure title="Costas">
        <BackBody shares={shares} />
      </Figure>
    </div>
  );
}

function Figure({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <svg
        viewBox="0 0 120 226"
        className="h-auto w-full"
        role="img"
        aria-label={`Volume por músculo, vista de ${title.toLowerCase()}`}
      >
        {children}
      </svg>
      <p className="label mt-1 text-center">{title}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ front */

function FrontBody({ shares }: { shares: Shares }) {
  const neutral = "rgba(255, 255, 255, 0.04)";
  return (
    <g stroke={OUTLINE} strokeWidth="1">
      {/* head and neck */}
      <circle cx="60" cy="16" r="12" fill={neutral} />
      <rect x="54" y="27" width="12" height="8" rx="3" fill={neutral} />

      {/* shoulders */}
      <ellipse cx="33" cy="45" rx="12" ry="9" fill={fill(shares, "ombros")} />
      <ellipse cx="87" cy="45" rx="12" ry="9" fill={fill(shares, "ombros")} />

      {/* chest */}
      <rect x="41" y="36" width="38" height="26" rx="9" fill={fill(shares, "peito")} />

      {/* abdomen */}
      <rect x="48" y="64" width="24" height="36" rx="7" fill={fill(shares, "abdominais")} />

      {/* upper arms */}
      <rect x="21" y="54" width="12" height="30" rx="6" fill={fill(shares, "bíceps")} />
      <rect x="87" y="54" width="12" height="30" rx="6" fill={fill(shares, "bíceps")} />

      {/* forearms, not tracked */}
      <rect x="20" y="86" width="11" height="28" rx="5" fill={neutral} />
      <rect x="89" y="86" width="11" height="28" rx="5" fill={neutral} />

      {/* hips */}
      <rect x="44" y="102" width="32" height="14" rx="6" fill={neutral} />

      {/* thighs */}
      <rect x="42" y="118" width="16" height="54" rx="8" fill={fill(shares, "quadríceps")} />
      <rect x="62" y="118" width="16" height="54" rx="8" fill={fill(shares, "quadríceps")} />

      {/* shins, not tracked */}
      <rect x="44" y="176" width="13" height="42" rx="6" fill={neutral} />
      <rect x="63" y="176" width="13" height="42" rx="6" fill={neutral} />
    </g>
  );
}

/* ------------------------------------------------------------------- back */

function BackBody({ shares }: { shares: Shares }) {
  const neutral = "rgba(255, 255, 255, 0.04)";
  return (
    <g stroke={OUTLINE} strokeWidth="1">
      <circle cx="60" cy="16" r="12" fill={neutral} />
      <rect x="54" y="27" width="12" height="8" rx="3" fill={neutral} />

      <ellipse cx="33" cy="45" rx="12" ry="9" fill={fill(shares, "ombros")} />
      <ellipse cx="87" cy="45" rx="12" ry="9" fill={fill(shares, "ombros")} />

      {/* upper back */}
      <rect x="41" y="36" width="38" height="18" rx="7" fill={fill(shares, "costas")} />

      {/* lats */}
      <path
        d="M41 56 L79 56 L74 84 L46 84 Z"
        fill={fill(shares, "dorsais")}
      />

      {/* lower back */}
      <rect x="48" y="86" width="24" height="18" rx="6" fill={fill(shares, "lombar")} />

      {/* triceps */}
      <rect x="21" y="54" width="12" height="30" rx="6" fill={fill(shares, "tríceps")} />
      <rect x="87" y="54" width="12" height="30" rx="6" fill={fill(shares, "tríceps")} />

      <rect x="20" y="86" width="11" height="28" rx="5" fill={neutral} />
      <rect x="89" y="86" width="11" height="28" rx="5" fill={neutral} />

      {/* glutes */}
      <rect x="44" y="106" width="32" height="18" rx="8" fill={fill(shares, "glúteos")} />

      {/* hamstrings */}
      <rect x="42" y="126" width="16" height="46" rx="8" fill={fill(shares, "isquiotibiais")} />
      <rect x="62" y="126" width="16" height="46" rx="8" fill={fill(shares, "isquiotibiais")} />

      {/* calves */}
      <rect x="44" y="176" width="13" height="42" rx="6" fill={fill(shares, "gémeos")} />
      <rect x="63" y="176" width="13" height="42" rx="6" fill={fill(shares, "gémeos")} />
    </g>
  );
}
