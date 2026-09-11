ALTER TABLE "media"
  ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "is_primary" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "media_owner_type_owner_id_type_is_primary_sort_order_idx"
  ON "media"("owner_type", "owner_id", "type", "is_primary", "sort_order");

CREATE UNIQUE INDEX IF NOT EXISTS "media_one_primary_product_image"
  ON "media"("owner_type", "owner_id")
  WHERE "owner_type" = 'Product' AND "type" = 'image' AND "is_primary" = true;
