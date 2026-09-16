#!/usr/bin/env tsx
/**
 * One-off backfill: re-runs every already-stored `Media` image through `optimizeImage`
 * (`image-optimizer.ts`), overwriting it at the SAME storage key.
 *
 * `optimizeImage` only ran on NEW uploads until now (`MediaService.uploadOwnedImage`) — every
 * image stored before that existed is still the admin's raw, unresized, uncompressed upload.
 * This walks the `media` table and applies the same transformation retroactively.
 *
 * Only the object bytes at each key change. No `Media` row, no `url`, and no other table is
 * touched — a product or article's image keeps the exact URL it already has.
 *
 * `--dry-run` (the default) reports what each image would shrink to without writing anything.
 * `--apply` performs the writes. Safe to run more than once: an image that does not shrink
 * further (already at or under the size cap, already recompressed) is left alone either way.
 *
 * Usage:
 *   pnpm media:optimize-backfill                 # report only
 *   pnpm media:optimize-backfill -- --apply       # write
 */
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { PrismaPg } from "@prisma/adapter-pg";

import { MediaType, PrismaClient } from "../../prisma/generated/client";

import { optimizeImage } from "./image-optimizer";

import type { Readable } from "node:stream";

const MIME_BY_EXTENSION: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

/** The same four values `MediaService.storage()` reads — this script has no ConfigService. */
function storageConfig(): {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
} {
  return {
    endpoint: requiredEnv("PRODUCT_MEDIA_ENDPOINT"),
    region: process.env["PRODUCT_MEDIA_REGION"]?.trim() || "us-east-1",
    bucket: requiredEnv("PRODUCT_MEDIA_BUCKET"),
    accessKeyId: requiredEnv("PRODUCT_MEDIA_ACCESS_KEY_ID"),
    secretAccessKey: requiredEnv("PRODUCT_MEDIA_SECRET_ACCESS_KEY"),
  };
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array));
  }
  return Buffer.concat(chunks);
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const storage = storageConfig();
  const s3 = new S3Client({
    endpoint: storage.endpoint,
    region: storage.region,
    forcePathStyle: true,
    credentials: { accessKeyId: storage.accessKeyId, secretAccessKey: storage.secretAccessKey },
  });

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: requiredEnv("DATABASE_URL") }),
  });

  try {
    const rows = await prisma.media.findMany({
      where: { type: MediaType.IMAGE },
      select: { id: true, url: true, ownerType: true, ownerId: true },
      orderBy: { id: "asc" },
    });

    console.log(`${apply ? "Applying" : "Dry run —"} ${String(rows.length)} image row(s).\n`);

    let shrunk = 0;
    let unchanged = 0;
    let failed = 0;
    let totalBefore = 0;
    let totalAfter = 0;

    for (const row of rows) {
      const label = `${row.id} (${row.ownerType}/${row.ownerId})`;

      if (!row.url.startsWith("/media/")) {
        console.warn(`  skip ${label}: url "${row.url}" is not object-storage owned.`);
        unchanged++;
        continue;
      }

      const key = row.url.slice("/media/".length);
      const extension = key.slice(key.lastIndexOf(".")).toLowerCase();
      const mimetype = MIME_BY_EXTENSION[extension];

      if (!mimetype) {
        console.warn(`  skip ${label}: unrecognized extension "${extension}".`);
        unchanged++;
        continue;
      }

      try {
        const object = await s3.send(new GetObjectCommand({ Bucket: storage.bucket, Key: key }));
        if (!object.Body) throw new Error("empty response body");
        const original = await streamToBuffer(object.Body as Readable);
        const optimized = await optimizeImage(original, mimetype);

        if (optimized.length >= original.length) {
          console.log(`  keep  ${label}: already optimal (${String(original.length)}B).`);
          unchanged++;
          totalBefore += original.length;
          totalAfter += original.length;
          continue;
        }

        const verb = apply ? "shrank" : "would shrink";
        console.log(
          `  ${verb} ${label}: ${String(original.length)}B -> ${String(optimized.length)}B`,
        );
        shrunk++;
        totalBefore += original.length;
        totalAfter += optimized.length;

        if (apply) {
          await s3.send(
            new PutObjectCommand({
              Bucket: storage.bucket,
              Key: key,
              Body: optimized,
              ContentType: mimetype,
              CacheControl: "public, max-age=31536000, immutable",
            }),
          );
        }
      } catch (error) {
        failed++;
        console.error(
          `  FAILED ${label}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    console.log(
      `\n${String(shrunk)} ${apply ? "shrunk" : "would shrink"}, ${String(unchanged)} already optimal or skipped, ${String(failed)} failed.`,
    );
    if (totalBefore > 0) {
      const pct = Math.round((1 - totalAfter / totalBefore) * 100);
      console.log(
        `Total: ${String(totalBefore)}B -> ${String(totalAfter)}B (${String(pct)}% smaller).`,
      );
    }
    if (!apply && shrunk > 0) console.log("\nRe-run with `-- --apply` to write these changes.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
