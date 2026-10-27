-- ADR-027: localized product editorial content.
--
-- One row per (product, non-default locale). The default locale's editorial content stays
-- where it already lives (`product_editorial_drafts` and the `products` columns); this table
-- never holds it, and the trigger below refuses a row for whichever locale is the default at
-- write time, so the two stores cannot both claim one locale.
CREATE TABLE "product_editorial_localizations" (
  "product_id" UUID NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "locale" TEXT NOT NULL REFERENCES "locales"("code") ON DELETE RESTRICT ON UPDATE CASCADE,
  "revision" INTEGER NOT NULL DEFAULT 0 CHECK ("revision" >= 0),
  "content" JSONB NOT NULL,
  "published_sections" JSONB,
  "translation_status" "translation_status" NOT NULL DEFAULT 'machine_draft',
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  PRIMARY KEY ("product_id", "locale")
);

CREATE FUNCTION "product_editorial_localizations_refuse_default_locale"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "locales" WHERE "code" = NEW."locale" AND "is_default") THEN
    RAISE EXCEPTION 'product_editorial_localizations never holds the default locale (%)', NEW."locale"
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "product_editorial_localizations_refuse_default_locale"
  BEFORE INSERT OR UPDATE OF "locale" ON "product_editorial_localizations"
  FOR EACH ROW EXECUTE FUNCTION "product_editorial_localizations_refuse_default_locale"();
