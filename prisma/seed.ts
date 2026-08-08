/**
 * Seeds sam_platform with the confirmed Phase 1 locale set.
 *
 * Locale only. Product categories are NOT seeded here: they are Catalog content
 * and belong with the Catalog module, not with database bootstrap.
 *
 * Locale rows must exist before any SeoMeta, ContentTranslation, Redirect or
 * NewsletterSubscription row can be created — those tables carry a foreign key
 * to Locale.code, so this seed is a hard prerequisite, not a convenience.
 *
 * Idempotent: re-running upserts by `code` rather than inserting duplicates.
 *
 * Run with `pnpm exec prisma db seed` (wired via migrations.seed in
 * prisma.config.ts), or directly with `tsx prisma/seed.ts`.
 */
import { existsSync } from "node:fs";

import { PrismaPg } from "@prisma/adapter-pg";

// The generated directory has no index barrel, so the entry point is the
// client.ts inside it — not the directory itself.
import { LocaleDirection, PrismaClient } from "./generated/client/client";

// Prisma 7 does not load .env automatically, and this file is also runnable
// outside the Prisma CLI. Guarded because a fresh clone has no .env yet.
if (existsSync(".env")) {
  process.loadEnvFile();
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set — copy .env.example to .env before seeding.");
}

// Prisma 7 requires a driver adapter for a direct PostgreSQL connection.
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

/**
 * The confirmed launch set: `en` default, plus `fa` and `ar`, all three
 * shipping together rather than phased. Any further language is a new row
 * here plus translated content — never a code change.
 */
const LOCALES = [
  {
    code: "en",
    name: "English",
    nativeName: "English",
    direction: LocaleDirection.LTR,
    isActive: true,
    isDefault: true,
    sortOrder: 1,
  },
  {
    code: "fa",
    name: "Persian",
    nativeName: "فارسی",
    direction: LocaleDirection.RTL,
    isActive: true,
    isDefault: false,
    sortOrder: 2,
  },
  {
    code: "ar",
    name: "Arabic",
    nativeName: "العربية",
    direction: LocaleDirection.RTL,
    isActive: true,
    isDefault: false,
    sortOrder: 3,
  },
];

async function main(): Promise<void> {
  for (const locale of LOCALES) {
    await prisma.locale.upsert({
      where: { code: locale.code },
      update: locale,
      create: locale,
    });
  }

  console.info(`Seeded ${LOCALES.length} locales: ${LOCALES.map((l) => l.code).join(", ")}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
