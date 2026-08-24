/**
 * Builds the local exercise catalogue.
 *
 * Downloads the free-exercise-db dataset (public domain), keeps only the
 * curated movements listed in scripts/catalogue.mjs, copies their artwork into
 * public/catalogue/<slug>/, and writes src/data/catalogue.json.
 *
 *   node scripts/build-catalogue.mjs
 */
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { CATALOGUE } from "./catalogue.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATASET_URL =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";
const IMAGE_BASE =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises";

const CACHE = resolve(ROOT, "node_modules/.cache/free-exercise-db.json");
const IMAGE_DIR = resolve(ROOT, "public/catalogue");
const OUT = resolve(ROOT, "src/data/catalogue.json");

async function loadDataset() {
  if (existsSync(CACHE)) {
    return JSON.parse(await readFile(CACHE, "utf8"));
  }
  const response = await fetch(DATASET_URL);
  if (!response.ok) throw new Error(`dataset download failed: ${response.status}`);
  const data = await response.json();
  await mkdir(dirname(CACHE), { recursive: true });
  await writeFile(CACHE, JSON.stringify(data));
  return data;
}

async function downloadImage(sourceId, index, target) {
  if (existsSync(target)) return true;
  const response = await fetch(`${IMAGE_BASE}/${sourceId}/${index}.jpg`);
  if (!response.ok) return false;
  await writeFile(target, Buffer.from(await response.arrayBuffer()));
  return true;
}

const dataset = await loadDataset();
const bySource = new Map(dataset.map((item) => [item.id, item]));

const missing = CATALOGUE.filter((entry) => !bySource.has(entry.source));
if (missing.length > 0) {
  console.error("Unknown source ids:", missing.map((m) => m.source).join(", "));
  process.exit(1);
}

const slugs = new Set();
for (const entry of CATALOGUE) {
  if (slugs.has(entry.slug)) {
    console.error(`Duplicate slug: ${entry.slug}`);
    process.exit(1);
  }
  slugs.add(entry.slug);

  // The training screen shows these to someone who has never done the
  // movement; an entry without them would be worse than no explanation.
  if (!Array.isArray(entry.steps) || entry.steps.length < 3) {
    console.error(`${entry.slug}: needs at least three steps`);
    process.exit(1);
  }
  if (!Array.isArray(entry.mistakes) || entry.mistakes.length < 2) {
    console.error(`${entry.slug}: needs at least two common mistakes`);
    process.exit(1);
  }
}

await mkdir(IMAGE_DIR, { recursive: true });

const output = [];
let downloaded = 0;

for (const entry of CATALOGUE) {
  const source = bySource.get(entry.source);
  const dir = resolve(IMAGE_DIR, entry.slug);
  await mkdir(dir, { recursive: true });

  const images = [];
  for (let index = 0; index < 2; index += 1) {
    const target = resolve(dir, `${index}.jpg`);
    const existed = existsSync(target);
    if (await downloadImage(entry.source, index, target)) {
      images.push(`/catalogue/${entry.slug}/${index}.jpg`);
      if (!existed) downloaded += 1;
    }
  }

  if (images.length === 0) {
    console.error(`No artwork for ${entry.slug}`);
    process.exit(1);
  }

  output.push({
    slug: entry.slug,
    name: entry.name,
    primary_muscle: entry.muscle,
    secondary: source.secondaryMuscles ?? [],
    equipment: source.equipment ?? "body only",
    category: source.category ?? "strength",
    family: entry.family,
    increment_kg: entry.increment,
    images,
    cues: entry.cues,
    steps: entry.steps ?? [],
    mistakes: entry.mistakes ?? [],
    instructions: (source.instructions ?? []).join(" "),
    profiles_ok: entry.profiles,
    is_timed: Boolean(entry.timed),
    per_side: Boolean(entry.perSide),
  });
}

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, `${JSON.stringify(output, null, 2)}\n`);

console.log(
  `catalogue: ${output.length} exercises, ${downloaded} new images, written to src/data/catalogue.json`,
);
