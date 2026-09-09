CREATE TABLE "product_editorial_drafts" (
  "product_id" UUID PRIMARY KEY REFERENCES "products"("id") ON DELETE CASCADE,
  "revision" INTEGER NOT NULL DEFAULT 0 CHECK ("revision" >= 0),
  "content" JSONB NOT NULL,
  "updated_at" TIMESTAMPTZ(6) NOT NULL
);
