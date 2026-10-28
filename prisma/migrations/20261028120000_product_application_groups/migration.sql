-- ADR-029: per-family application groups (the machine or application a product serves).
--
-- A group belongs to exactly one Product Family (`categories` row). A product is in at most one
-- group, and only in a group of its own family — the trigger below enforces that, because a
-- composite foreign key cannot express "nullable group, required family" in Prisma's model.
CREATE TABLE "application_groups" (
  "id" UUID PRIMARY KEY,
  "category_id" UUID NOT NULL REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "slug" TEXT NOT NULL CHECK (btrim("slug") <> '' AND "slug" = lower("slug")),
  "name" TEXT NOT NULL CHECK (btrim("name") <> ''),
  "sort_order" INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX "application_groups_category_id_slug_key"
  ON "application_groups" ("category_id", "slug");

ALTER TABLE "products"
  ADD COLUMN "application_group_id" UUID
    REFERENCES "application_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "products_application_group_id_idx" ON "products" ("application_group_id");

CREATE FUNCTION "products_application_group_same_family"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."application_group_id" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "application_groups" g
    WHERE g."id" = NEW."application_group_id" AND g."category_id" = NEW."category_id"
  ) THEN
    RAISE EXCEPTION 'A product can only be in an application group of its own family'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "products_application_group_same_family"
  BEFORE INSERT OR UPDATE OF "application_group_id", "category_id" ON "products"
  FOR EACH ROW EXECUTE FUNCTION "products_application_group_same_family"();

-- Moving a group to another family would strand its products in the wrong family.
CREATE FUNCTION "application_groups_family_fixed"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."category_id" <> OLD."category_id" AND EXISTS (
    SELECT 1 FROM "products" p WHERE p."application_group_id" = OLD."id"
  ) THEN
    RAISE EXCEPTION 'An application group with products cannot move to another family'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "application_groups_family_fixed"
  BEFORE UPDATE OF "category_id" ON "application_groups"
  FOR EACH ROW EXECUTE FUNCTION "application_groups_family_fixed"();
