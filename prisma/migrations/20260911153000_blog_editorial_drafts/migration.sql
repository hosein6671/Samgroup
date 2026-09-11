CREATE TABLE "blog_editorial_drafts" (
  "blog_post_id" UUID PRIMARY KEY REFERENCES "blog_posts"("id") ON DELETE CASCADE,
  "revision" INTEGER NOT NULL DEFAULT 0 CHECK ("revision" >= 0),
  "content" JSONB NOT NULL,
  "updated_at" TIMESTAMPTZ(6) NOT NULL
);
