-- Adds `updated_at` to `blog_posts`, feeding `dateModified` in the Article JSON-LD
-- (SEO_ARCHITECTURE.md §8). Backfilled to `created_at`-equivalent for any existing row —
-- there is no created_at column, so `published_at` when set, else `now()`, is the closest
-- honest value a pre-existing row can carry. Prisma's `@updatedAt` takes over from the next
-- write onward.
ALTER TABLE "blog_posts" ADD COLUMN "updated_at" TIMESTAMPTZ(6);

UPDATE "blog_posts" SET "updated_at" = COALESCE("published_at", now());

ALTER TABLE "blog_posts" ALTER COLUMN "updated_at" SET NOT NULL;
