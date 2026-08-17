import { deflateSync } from "node:zlib";

/**
 * A generated, deliberately meaningless PNG for the demo seed.
 *
 * ── Why it is generated rather than committed ──────────────────────────────
 *
 * The runtime proof needs *an* image, and every real candidate is a problem. A photograph of a
 * facility, a certificate, a product or a logo would be a company claim seeded into a database —
 * exactly what SITE_STRUCTURE.md §7 warns against for certifications, and worse for anything that
 * looks like branding, because a placeholder that reads as finished is more dangerous than a
 * visible gap. A stock image would carry a licence question nobody has answered. A binary blob in
 * the repository would be an asset no one can review in a diff.
 *
 * So the bytes are computed here, from nothing: a flat grey rectangle with a single darker band, no
 * text, no mark, no resemblance to anything SAM Group owns or claims. Reviewable as code, and
 * obviously not real content when it appears in the admin panel.
 *
 * ── Why the PNG is hand-encoded ────────────────────────────────────────────
 *
 * `apps/cms` has no image library and does not need one for this. A PNG is four chunks with CRCs
 * around a zlib stream, and `node:zlib` supplies the only hard part. Adding a dependency to draw a
 * grey rectangle would be a worse trade than sixty lines of well-understood format code.
 */

/** 1200×630 — the platform's social-card convention (SEO_ARCHITECTURE.md §Image SEO). */
const WIDTH = 1200;
const HEIGHT = 630;

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

function crc32(buffer: Buffer): number {
  let c = -1;

  for (const byte of buffer) {
    c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  }

  return (c ^ -1) >>> 0;
}

/** One PNG chunk: length, type, payload, CRC over type+payload. */
function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);

  const typed = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));

  return Buffer.concat([length, typed, crc]);
}

/**
 * Build the demo image.
 *
 * @returns a complete 8-bit RGB PNG. Deterministic — the same bytes every run, which is part of what
 *   makes the seed idempotent rather than merely non-duplicating.
 */
export function demoImagePng(): Buffer {
  // Each row is a filter byte (0 = none) followed by RGB triples.
  const stride = WIDTH * 3 + 1;
  const raw = Buffer.alloc(stride * HEIGHT);

  for (let y = 0; y < HEIGHT; y += 1) {
    const rowStart = y * stride;
    raw[rowStart] = 0;

    // A darker horizontal band across the middle third, so the image is visibly an image rather
    // than a blank field, without conveying anything.
    const inBand = y > HEIGHT / 3 && y < (HEIGHT * 2) / 3;
    const value = inBand ? 0x9a : 0xc8;

    for (let x = 0; x < WIDTH; x += 1) {
      const offset = rowStart + 1 + x * 3;
      raw[offset] = value;
      raw[offset + 1] = value;
      raw[offset + 2] = value;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(WIDTH, 0);
  ihdr.writeUInt32BE(HEIGHT, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour RGB
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

export const DEMO_IMAGE_DIMENSIONS = { width: WIDTH, height: HEIGHT } as const;
