/**
 * Generates the application icons as PNG files with no image dependencies.
 * Draws a barbell mark in brass on the ink background.
 *
 *   node scripts/generate-icons.mjs
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = resolve(ROOT, "public/icons");

const INK = [0x0b, 0x0c, 0x0a];
const BRASS = [0xc2, 0xa4, 0x67];

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}

function encodePng(size, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // colour type: truecolour
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (size * 3 + 1);
    raw[rowStart] = 0; // filter: none
    for (let x = 0; x < size; x += 1) {
      const [r, g, b] = pixels[y][x];
      const offset = rowStart + 1 + x * 3;
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Coverage of a rectangle in a pixel, sampled 3x3 for smooth edges. */
function coverage(x, y, rect) {
  let hits = 0;
  for (let sy = 0; sy < 3; sy += 1) {
    for (let sx = 0; sx < 3; sx += 1) {
      const px = x + (sx + 0.5) / 3;
      const py = y + (sy + 0.5) / 3;
      if (px >= rect.x0 && px <= rect.x1 && py >= rect.y0 && py <= rect.y1) {
        hits += 1;
      }
    }
  }
  return hits / 9;
}

function mix(base, top, alpha) {
  return [
    Math.round(base[0] + (top[0] - base[0]) * alpha),
    Math.round(base[1] + (top[1] - base[1]) * alpha),
    Math.round(base[2] + (top[2] - base[2]) * alpha),
  ];
}

function draw(size) {
  const u = size / 24; // work in a 24 unit grid
  const shapes = [
    { x0: 3 * u, y0: 10 * u, x1: 4.4 * u, y1: 14 * u }, // outer plate, left
    { x0: 5.2 * u, y0: 8 * u, x1: 7.2 * u, y1: 16 * u }, // inner plate, left
    { x0: 7.2 * u, y0: 11.2 * u, x1: 16.8 * u, y1: 12.8 * u }, // bar
    { x0: 16.8 * u, y0: 8 * u, x1: 18.8 * u, y1: 16 * u }, // inner plate, right
    { x0: 19.6 * u, y0: 10 * u, x1: 21 * u, y1: 14 * u }, // outer plate, right
  ];

  const pixels = [];
  for (let y = 0; y < size; y += 1) {
    const row = [];
    for (let x = 0; x < size; x += 1) {
      let colour = INK;
      let alpha = 0;
      for (const shape of shapes) {
        alpha = Math.max(alpha, coverage(x, y, shape));
      }
      if (alpha > 0) colour = mix(INK, BRASS, alpha);
      row.push(colour);
    }
    pixels.push(row);
  }
  return pixels;
}

mkdirSync(OUT_DIR, { recursive: true });

for (const [name, size] of [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["apple-touch-icon.png", 180],
]) {
  writeFileSync(resolve(OUT_DIR, name), encodePng(size, draw(size)));
  console.log(`wrote public/icons/${name}`);
}
