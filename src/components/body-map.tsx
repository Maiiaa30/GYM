/**
 * The week's work drawn on a body, front and back.
 *
 * The regions are **generated from shared edge profiles** rather than drawn by
 * hand. Every part of the figure is a band between two outlines, cut at a set
 * of heights, so neighbouring regions share an edge exactly: no overlaps, no
 * gaps, and no chance of one shape sitting inside another. Hand-authored paths
 * were tried first and could not be made to tile — a muscle would creep over
 * the ribs, or leave a dark channel that read as a third region.
 *
 * Fills are opaque, mixed against the card's own background, because
 * translucent fills compound wherever anything overlaps.
 *
 * Deliberately schematic: at the size of a phone what matters is which areas
 * are lit and which are dark, not the shape of a muscle.
 */

type Rgb = [number, number, number];

const SURFACE: Rgb = [19, 21, 18]; // --color-surface, the card behind this
const PARCHMENT: Rgb = [236, 230, 216];
const BRASS: Rgb = [194, 164, 103];

function mix(base: Rgb, tint: Rgb, amount: number): string {
  const channel = (i: number) =>
    Math.round(base[i] + (tint[i] - base[i]) * amount);
  return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`;
}

const BODY = mix(SURFACE, PARCHMENT, 0.11);
const EDGE = mix(SURFACE, PARCHMENT, 0.26);
const SEAM = mix(SURFACE, PARCHMENT, 0.03);

function shade(share: number): string {
  if (share <= 0) return BODY;
  return mix(SURFACE, BRASS, 0.24 + share * 0.66);
}

/* ------------------------------------------------------------------ edges */

/** An outline as (height, x) pairs, read by interpolating between them. */
type Edge = Array<[number, number]>;

function xAt(edge: Edge, y: number): number {
  if (y <= edge[0][0]) return edge[0][1];
  const last = edge[edge.length - 1];
  if (y >= last[0]) return last[1];

  for (let i = 1; i < edge.length; i += 1) {
    const [y1, x1] = edge[i];
    if (y > y1) continue;
    const [y0, x0] = edge[i - 1];
    return x0 + ((x1 - x0) * (y - y0)) / (y1 - y0);
  }
  return last[1];
}

/** A closed band between two outlines, from `top` down to `bottom`. */
function band(outer: Edge, inner: Edge, top: number, bottom: number): string {
  const steps: number[] = [];
  for (let y = top; y < bottom; y += 2) steps.push(y);
  steps.push(bottom);

  const down = steps.map((y) => `${xAt(outer, y).toFixed(1)} ${y.toFixed(1)}`);
  const up = [...steps]
    .reverse()
    .map((y) => `${xAt(inner, y).toFixed(1)} ${y.toFixed(1)}`);

  return `M${down.concat(up).join(" L")} Z`;
}

const CENTRE: Edge = [
  [0, 60],
  [250, 60],
];

/** Ribcage down to the hips: shoulders wide, waist in, hips out again. */
const TRUNK: Edge = [
  [40, 44],
  [48, 39],
  [60, 37],
  [76, 39],
  [94, 43],
  [108, 40],
  [120, 38],
  [124, 39],
];

/** The arm's inner edge follows the trunk, so the two always touch. */
const ARM_INNER: Edge = [
  [40, 44],
  [48, 39],
  [60, 37],
  [76, 37],
  [160, 37],
];

const ARM_OUTER: Edge = [
  [40, 32],
  [48, 25],
  [60, 24],
  [78, 25],
  [100, 27],
  [130, 28],
  [150, 30],
];

const LEG_OUTER: Edge = [
  [124, 38],
  [145, 39],
  [176, 43],
  [186, 45],
  [208, 45],
  [228, 48],
  [236, 47],
];

const LEG_INNER: Edge = [
  [124, 58],
  [145, 57],
  [176, 56],
  [186, 56],
  [208, 56],
  [228, 55],
  [236, 56],
];

/* ------------------------------------------------------------------ parts */

export type MuscleShare = { muscle: string; sets: number; share: number };

function reader(rows: MuscleShare[]) {
  const byMuscle = new Map(rows.map((row) => [row.muscle, row]));
  return (muscle: string) => {
    const row = byMuscle.get(muscle);
    const sets = row?.sets ?? 0;
    return {
      fill: shade(row?.share ?? 0),
      title: `${muscle}: ${sets} ${sets === 1 ? "série" : "séries"}`,
    };
  };
}

type Region = { d: string; fill: string; title?: string };

function Regions({ regions }: { regions: Region[] }) {
  return (
    <>
      {regions.map((region) => (
        <path
          key={region.d.slice(0, 40) + region.fill}
          d={region.d}
          fill={region.fill}
          stroke={SEAM}
          strokeWidth="0.7"
        >
          {region.title ? <title>{region.title}</title> : null}
        </path>
      ))}
    </>
  );
}

function Mirrored({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <g transform="translate(120, 0) scale(-1, 1)">{children}</g>
    </>
  );
}

/** The parts that carry no muscle group, identical on both views. */
function Common() {
  return (
    <g stroke={EDGE} strokeWidth="0.8" fill={BODY}>
      <ellipse cx="60" cy="20" rx="13" ry="15" />
      <path d="M52 31 h16 v11 q-8 4 -16 0 z" />
    </g>
  );
}

/** Hands and feet, so the limbs do not end in a flat cut. */
function Extremities() {
  return (
    <g stroke={EDGE} strokeWidth="0.8" fill={BODY}>
      <ellipse cx="33" cy="156" rx="6" ry="9" />
      <path d="M47 234 q-3 8 1 11 h11 q2 -5 -1 -11 z" />
    </g>
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
        viewBox="0 0 120 250"
        className="h-auto w-full"
        role="img"
        aria-label={`Séries por músculo, vista de ${title.toLowerCase()}`}
      >
        {children}
      </svg>
      <p className="label mt-1 text-center">{title}</p>
    </div>
  );
}

export function BodyMap({ rows }: { rows: MuscleShare[] }) {
  const at = reader(rows);

  const arm = (fill: string, title: string): Region[] => [
    { d: band(ARM_OUTER, ARM_INNER, 40, 64), ...at("ombros") },
    { d: band(ARM_OUTER, ARM_INNER, 64, 104), fill, title },
    { d: band(ARM_OUTER, ARM_INNER, 104, 150), fill: BODY },
  ];

  const front: Region[] = [
    { d: band(TRUNK, CENTRE, 40, 78), ...at("peito") },
    { d: band(TRUNK, CENTRE, 78, 116), ...at("abdominais") },
    { d: band(TRUNK, CENTRE, 116, 124), fill: BODY },
    { d: band(LEG_OUTER, LEG_INNER, 124, 178), ...at("quadríceps") },
    { d: band(LEG_OUTER, LEG_INNER, 178, 236), fill: BODY },
    ...arm(at("bíceps").fill, at("bíceps").title),
  ];

  const back: Region[] = [
    { d: band(TRUNK, CENTRE, 40, 64), ...at("costas") },
    { d: band(TRUNK, CENTRE, 64, 98), ...at("dorsais") },
    { d: band(TRUNK, CENTRE, 98, 118), ...at("lombar") },
    { d: band(TRUNK, CENTRE, 118, 124), fill: BODY },
    { d: band(LEG_OUTER, LEG_INNER, 124, 146), ...at("glúteos") },
    { d: band(LEG_OUTER, LEG_INNER, 146, 180), ...at("isquiotibiais") },
    { d: band(LEG_OUTER, LEG_INNER, 180, 224), ...at("gémeos") },
    { d: band(LEG_OUTER, LEG_INNER, 224, 236), fill: BODY },
    ...arm(at("tríceps").fill, at("tríceps").title),
  ];

  return (
    <div className="grid grid-cols-2 gap-3 px-5 py-1">
      <Figure title="Frente">
        <Common />
        <Mirrored>
          <Extremities />
          <Regions regions={front} />
        </Mirrored>
      </Figure>
      <Figure title="Costas">
        <Common />
        <Mirrored>
          <Extremities />
          <Regions regions={back} />
        </Mirrored>
      </Figure>
    </div>
  );
}
