-- ============================================================================
-- ADR-011 — Products Slug Namespace Enforcement, Shared Claim Registry
--
-- Installs the durable enforcement ADR-010 §6 requires before the first Product
-- write, the first Product reference data, or the first Category/Product
-- translated-slug row.
--
-- WHY THE EXPLICIT BEGIN/COMMIT BELOW
--
-- ADR-011 §11 requires this install to be atomic and says that if the migration
-- tooling does not provide those semantics, this gate must establish them.
-- It does not. Measured against a disposable probe database on 14 August 2026:
-- a migration file whose third statement raised left the two tables created by
-- the first two statements COMMITTED and present. Prisma applies the file
-- statement by statement in autocommit; there is no implicit wrapping
-- transaction. The same probe with an explicit BEGIN/COMMIT left zero objects
-- behind on failure, and applied cleanly on success including dollar-quoted
-- function bodies. So the transaction here is load-bearing, not decoration:
-- without it a validation failure at step 4 would leave the functions and the
-- table installed but unarmed and unpopulated.
--
-- WHAT IS DELIBERATELY NOT HERE
--
-- No Product row, no reference data, no reserved-vocabulary change, and nothing
-- touching content_translations_unique_slug — that partial index predates this
-- migration, is subsumed by the registry, and is RETAINED (ADR-011 §4). Segment
-- and ProductType slugs are not participating sources: they live behind the
-- reserved static path segments, which is a different mechanism for a different
-- problem.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Lock the participating sources.
--
-- Not optional (ADR-011 §11). Without it a write landing between the candidate
-- read below and the CREATE TRIGGER at step 6 would be permanently unclaimed
-- and invisible to the invariant — the one hole an install like this can leave.
-- SHARE ROW EXCLUSIVE conflicts with ROW EXCLUSIVE, so ordinary DML waits;
-- concurrent readers are unaffected.
-- ---------------------------------------------------------------------------
LOCK TABLE "categories", "products", "content_translations" IN SHARE ROW EXCLUSIVE MODE;

-- ---------------------------------------------------------------------------
-- 2. Helper functions, the registry, and its owner index.
-- ---------------------------------------------------------------------------

-- The namespace key. NFC first, then lower-case (ADR-011 §3).
--
-- Deeper fa/ar confusable folding — ZWNJ, Arabic-Indic digit variants, yeh and
-- kaf variants — is deliberately NOT here. Deciding it is deciding fa/ar slug
-- vocabulary, which ADR-010 §8 records as unapproved. Tightening this function
-- later is a migration plus a re-backfill, and nothing else depends on its
-- internals.
CREATE FUNCTION "slug_key"("value" TEXT) RETURNS TEXT
  LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
AS $fn$
  SELECT lower(normalize("value", NFC))
$fn$;

-- The database's enforcement copy of ADR-010 §4. That ADR is the authority; this
-- is one definition consulted by both the triggers and the validation below, so
-- the two cannot disagree. The TypeScript constant that will accompany a future
-- write path is a declaration only, and a test asserts it matches this.
CREATE FUNCTION "product_slug_reserved"() RETURNS TEXT[]
  LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $fn$
  SELECT ARRAY['finder', 'segments', 'types']::TEXT[]
$fn$;

-- Every participating slug source, in one place: ADR-011 §1's three bullets.
-- Used by the validation, the backfill and the coverage assertion, so "what
-- participates" has exactly one definition. NOT used by the release path, which
-- needs an owner-scoped lookup rather than a full scan — see
-- product_slug_owner_uses_key.
CREATE FUNCTION "product_slug_sources"()
  RETURNS TABLE ("owner_type" TEXT, "owner_id" UUID, "slug" TEXT, "slug_key" TEXT, "origin" TEXT)
  LANGUAGE sql STABLE
AS $fn$
  SELECT 'Category'::TEXT, c."id", c."slug", "slug_key"(c."slug"), 'base'::TEXT
    FROM "categories" c
  UNION ALL
  SELECT 'Product'::TEXT, p."id", p."slug", "slug_key"(p."slug"), 'base'::TEXT
    FROM "products" p
  UNION ALL
  SELECT ct."entity_type", ct."entity_id", ct."value", "slug_key"(ct."value"), 'translation'::TEXT
    FROM "content_translations" ct
   WHERE ct."field" = 'slug'
     AND ct."entity_type" IN ('Category', 'Product')
$fn$;

-- INV-3. Scoped to the two entity types that participate; a polymorphic foreign
-- key is impossible here and a generic redesign of content_translations is
-- explicitly out of scope (ADR-011 §1).
CREATE FUNCTION "product_slug_owner_exists"("p_owner_type" TEXT, "p_owner_id" UUID) RETURNS BOOLEAN
  LANGUAGE sql STABLE
AS $fn$
  SELECT CASE "p_owner_type"
    WHEN 'Category' THEN EXISTS (SELECT 1 FROM "categories" WHERE "id" = "p_owner_id")
    WHEN 'Product'  THEN EXISTS (SELECT 1 FROM "products"   WHERE "id" = "p_owner_id")
    ELSE FALSE
  END
$fn$;

-- The release recomputation (ADR-011 §5): does THIS owner still reach THIS key
-- from any of its sources? Owner-scoped on purpose — a primary-key fetch plus an
-- index scan on content_translations_entity_type_entity_id_idx, never a scan of
-- the namespace. This is what replaces a refcount.
CREATE FUNCTION "product_slug_owner_uses_key"("p_owner_type" TEXT, "p_owner_id" UUID, "p_slug_key" TEXT)
  RETURNS BOOLEAN LANGUAGE sql STABLE
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM "categories" c
      WHERE "p_owner_type" = 'Category' AND c."id" = "p_owner_id"
        AND "slug_key"(c."slug") = "p_slug_key"
    UNION ALL
    SELECT 1 FROM "products" p
      WHERE "p_owner_type" = 'Product' AND p."id" = "p_owner_id"
        AND "slug_key"(p."slug") = "p_slug_key"
    UNION ALL
    SELECT 1 FROM "content_translations" ct
      WHERE ct."entity_type" = "p_owner_type" AND ct."entity_id" = "p_owner_id"
        AND ct."field" = 'slug' AND "slug_key"(ct."value") = "p_slug_key"
  )
$fn$;

CREATE TABLE "product_slug_claims" (
    "slug_key" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "owner_type" TEXT NOT NULL,
    "owner_id" UUID NOT NULL,

    CONSTRAINT "product_slug_claims_pkey" PRIMARY KEY ("slug_key")
);

-- CreateIndex
CREATE INDEX "product_slug_claims_owner_type_owner_id_idx" ON "product_slug_claims"("owner_type", "owner_id");

-- ---------------------------------------------------------------------------
-- The one claim implementation, and the one release implementation.
--
-- Parallel arrays rather than a composite type or a temp table: a composite TYPE
-- is a schema object Prisma does not model and would be a drift candidate, and a
-- temp table per statement would cost more than the enforcement it carries.
-- ---------------------------------------------------------------------------

-- Claim, per ADR-011 §5 and the five ordered steps in its Decision:
-- reject reserved, verify owner exists, insert-on-conflict-do-nothing, then
-- VERIFY the resulting row's owner. Step 4 is not redundant with step 3 — it is
-- what makes both the concurrent case and the duplicate-keys-within-one-statement
-- case safe, because ON CONFLICT DO NOTHING is silent about which row won.
CREATE FUNCTION "product_slug_claim"("p_owner_types" TEXT[], "p_owner_ids" UUID[], "p_slugs" TEXT[])
  RETURNS VOID LANGUAGE plpgsql
AS $fn$
DECLARE
  v_bad   RECORD;
  d_types TEXT[];
  d_ids   UUID[];
  d_keys  TEXT[];
  d_slugs TEXT[];
BEGIN
  IF "p_owner_types" IS NULL OR array_length("p_owner_types", 1) IS NULL THEN
    RETURN;
  END IF;

  -- The intent set, deduplicated once, so a bulk statement claiming one key from
  -- several sources of the SAME owner performs one insert rather than fighting
  -- itself. Held in parallel arrays rather than a temp table: this runs on every
  -- write to three tables, and creating and dropping a temp relation per
  -- statement would put catalog churn on the path of a catalog import.
  SELECT array_agg(x."ot"), array_agg(x."oid"), array_agg(x."k"), array_agg(x."sl")
    INTO d_types, d_ids, d_keys, d_slugs
    FROM (
      SELECT DISTINCT
             t."owner_type" AS "ot",
             t."owner_id"   AS "oid",
             "slug_key"(t."slug") AS "k",
             min(t."slug") OVER (
               PARTITION BY t."owner_type", t."owner_id", "slug_key"(t."slug")
             ) AS "sl"
        FROM unnest("p_owner_types", "p_owner_ids", "p_slugs")
               AS t("owner_type", "owner_id", "slug")
    ) x;

  -- INV-2. Reserved values are never valid input, which is why this reports as a
  -- check violation and not as a conflict: a future write path maps 23514 here
  -- onto 400 VALIDATION_ERROR and 23505 below onto 409 CONFLICT (ADR-011 §12).
  SELECT i."owner_type", i."owner_id", i."slug_key" INTO v_bad
    FROM unnest(d_types, d_ids, d_keys, d_slugs)
           AS i("owner_type", "owner_id", "slug_key", "slug")
   WHERE i."slug_key" = ANY("product_slug_reserved"())
   LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'products slug namespace: % is reserved', v_bad."slug_key"
      USING ERRCODE = 'check_violation',
            DETAIL  = format('requested by %s %s', v_bad."owner_type", v_bad."owner_id"),
            HINT    = 'ADR-010 s4 reserves finder, segments and types in the products namespace.';
  END IF;

  -- INV-3.
  SELECT i."owner_type", i."owner_id", i."slug_key" INTO v_bad
    FROM unnest(d_types, d_ids, d_keys, d_slugs)
           AS i("owner_type", "owner_id", "slug_key", "slug")
   WHERE NOT "product_slug_owner_exists"(i."owner_type", i."owner_id")
   LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'products slug namespace: owner %s %s does not exist',
                    v_bad."owner_type", v_bad."owner_id"
      USING ERRCODE = 'foreign_key_violation',
            DETAIL  = format('attempted to claim %L', v_bad."slug_key"),
            HINT    = 'ADR-011 INV-3: a translated slug may not claim namespace for a missing entity.';
  END IF;

  INSERT INTO "product_slug_claims" ("slug_key", "slug", "owner_type", "owner_id")
  SELECT i."slug_key", i."slug", i."owner_type", i."owner_id"
    FROM unnest(d_types, d_ids, d_keys, d_slugs)
           AS i("owner_type", "owner_id", "slug_key", "slug")
  ON CONFLICT ("slug_key") DO NOTHING;

  -- INV-1. Same-owner reuse passes here by construction: the existing row's owner
  -- equals the intended owner, so it is not a conflict at all.
  SELECT i."slug_key", i."owner_type" AS "want_type", i."owner_id" AS "want_id",
         c."owner_type" AS "held_type", c."owner_id" AS "held_id"
    INTO v_bad
    FROM unnest(d_types, d_ids, d_keys, d_slugs)
           AS i("owner_type", "owner_id", "slug_key", "slug")
    JOIN "product_slug_claims" c ON c."slug_key" = i."slug_key"
   WHERE (c."owner_type", c."owner_id") IS DISTINCT FROM (i."owner_type", i."owner_id")
   LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'products slug namespace collision: % is already claimed', v_bad."slug_key"
      USING ERRCODE = 'unique_violation',
            DETAIL  = format('held by %s %s; requested by %s %s',
                             v_bad."held_type", v_bad."held_id", v_bad."want_type", v_bad."want_id"),
            HINT    = 'ADR-011 INV-1: one normalized slug key belongs to exactly one entity.';
  END IF;
END
$fn$;

-- Guarded release. Deletes a claim only when the SAME owner no longer reaches
-- that key from any surviving source — evaluated against post-statement state,
-- which is why every trigger below is AFTER and statement-level.
--
-- Scoped to claims this owner actually holds: releasing another entity's claim
-- would be the collision this whole mechanism exists to prevent, arriving by the
-- back door.
CREATE FUNCTION "product_slug_release"("p_owner_types" TEXT[], "p_owner_ids" UUID[], "p_slugs" TEXT[])
  RETURNS VOID LANGUAGE plpgsql
AS $fn$
BEGIN
  IF "p_owner_types" IS NULL OR array_length("p_owner_types", 1) IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM "product_slug_claims" c
   USING (
     SELECT DISTINCT t."owner_type", t."owner_id", "slug_key"(t."slug") AS "slug_key"
       FROM unnest("p_owner_types", "p_owner_ids", "p_slugs")
              AS t("owner_type", "owner_id", "slug")
   ) r
   WHERE c."slug_key"   = r."slug_key"
     AND c."owner_type" = r."owner_type"
     AND c."owner_id"   = r."owner_id"
     AND NOT "product_slug_owner_uses_key"(r."owner_type", r."owner_id", r."slug_key");
END
$fn$;

-- Unconditional release, for entity deletion only (ADR-011 §8).
--
-- Every claim the owner holds goes, not only the one its base slug produced:
-- content_translations has no foreign key to categories or products, so a
-- deleted entity's slug translations survive it, and releasing selectively would
-- strand those claims under an owner that no longer exists. The surviving
-- translation rows are left alone on purpose — repairing them is a separate
-- Database change, recorded in ADR-011's Deferred Decisions.
CREATE FUNCTION "product_slug_release_owner"("p_owner_types" TEXT[], "p_owner_ids" UUID[])
  RETURNS VOID LANGUAGE plpgsql
AS $fn$
BEGIN
  IF "p_owner_types" IS NULL OR array_length("p_owner_types", 1) IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM "product_slug_claims" c
   USING (
     SELECT DISTINCT t."owner_type", t."owner_id"
       FROM unnest("p_owner_types", "p_owner_ids") AS t("owner_type", "owner_id")
   ) r
   WHERE c."owner_type" = r."owner_type"
     AND c."owner_id"   = r."owner_id";
END
$fn$;

-- ---------------------------------------------------------------------------
-- 3-4. The candidate set, and the three validations that run before anything is
--      written.
--
-- Generic by construction: it reads whatever the three source tables hold, in
-- any valid pre-migration state. Nothing here assumes the six Category rows that
-- happen to exist in local DEV.
--
-- Every failure aborts with the FULL offending set and picks no winner. An
-- unexpected pre-existing row is a hard stop, because reconciling one is a data
-- decision with its own approval — not something a migration may decide.
-- ---------------------------------------------------------------------------
DO $validate$
DECLARE
  v_report TEXT;
BEGIN
  -- A. Reserved.
  SELECT string_agg(format('%s %s -> %L', s."owner_type", s."owner_id", s."slug"), '; ' ORDER BY s."slug")
    INTO v_report
    FROM "product_slug_sources"() s
   WHERE s."slug_key" = ANY("product_slug_reserved"());

  IF v_report IS NOT NULL THEN
    RAISE EXCEPTION 'ADR-011 install aborted: existing slugs normalize to reserved values. %', v_report
      USING HINT = 'Rename these rows, then re-run. This migration will not choose for you.';
  END IF;

  -- B. Cross-owner collision on the normalized key.
  SELECT string_agg(x."line", '; ' ORDER BY x."line") INTO v_report
    FROM (
      SELECT format('%L claimed by %s', s."slug_key",
                    string_agg(DISTINCT format('%s %s', s."owner_type", s."owner_id"), ' and ')) AS "line"
        FROM "product_slug_sources"() s
       GROUP BY s."slug_key"
      HAVING count(DISTINCT (s."owner_type", s."owner_id")) > 1
    ) x;

  IF v_report IS NOT NULL THEN
    RAISE EXCEPTION 'ADR-011 install aborted: normalized slug keys are claimed by more than one entity. %', v_report
      USING HINT = 'Resolve each collision by hand. Family precedence is a runtime rule, not a repair strategy.';
  END IF;

  -- C. Orphaned Category/Product slug translations (INV-3, applied to what already exists).
  SELECT string_agg(format('%s %s -> %L', ct."entity_type", ct."entity_id", ct."value"), '; '
                    ORDER BY ct."value")
    INTO v_report
    FROM "content_translations" ct
   WHERE ct."field" = 'slug'
     AND ct."entity_type" IN ('Category', 'Product')
     AND NOT "product_slug_owner_exists"(ct."entity_type", ct."entity_id");

  IF v_report IS NOT NULL THEN
    RAISE EXCEPTION 'ADR-011 install aborted: slug translations reference entities that do not exist. %', v_report
      USING HINT = 'These rows would claim a public URL for nothing. Remove or re-point them first.';
  END IF;
END
$validate$;

-- ---------------------------------------------------------------------------
-- 5. Generic backfill — exactly one claim per distinct normalized key.
--
-- DISTINCT ON is safe only because validation B just proved one owner per key;
-- it collapses the same owner's several sources, never two owners. The stored
-- `slug` is a diagnostic label, so its choice only has to be deterministic:
-- prefer a base-table literal, then the lowest value.
-- ---------------------------------------------------------------------------
INSERT INTO "product_slug_claims" ("slug_key", "slug", "owner_type", "owner_id")
SELECT DISTINCT ON (s."slug_key") s."slug_key", s."slug", s."owner_type", s."owner_id"
  FROM "product_slug_sources"() s
 ORDER BY s."slug_key", (s."origin" = 'base') DESC, s."slug";

-- ---------------------------------------------------------------------------
-- 6. Arm the triggers.
--
-- Statement-level AFTER with transition tables, and NO `WHEN` clause anywhere.
-- A `WHEN` clause that sees only NEW loses every release path — a slug
-- translation edited into another field, or re-typed to an unrelated entity,
-- would abandon its claim silently — and a single row trigger covering all three
-- events cannot reference both OLD and NEW in one. Filtering inside the body over
-- the transition sets is what makes the lifecycle exhaustive by construction.
--
-- Transition tables may be declared for one event each, hence three triggers per
-- table rather than one. The gain is that all releases run before all claims
-- across the whole statement, which is what makes owner reassignment and
-- multi-row renames work, and what keeps a bulk import set-based.
-- ---------------------------------------------------------------------------

CREATE FUNCTION "product_slug_tg_categories_ins"() RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
DECLARE t TEXT[]; i UUID[]; s TEXT[];
BEGIN
  SELECT array_agg('Category'::TEXT), array_agg(n."id"), array_agg(n."slug")
    INTO t, i, s FROM "newtab" n;
  PERFORM "product_slug_claim"(t, i, s);
  RETURN NULL;
END $fn$;

CREATE FUNCTION "product_slug_tg_categories_upd"() RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
DECLARE t TEXT[]; i UUID[]; s TEXT[];
BEGIN
  -- Release before claim. Not interchangeable: reassigning a key from one owner
  -- to another inside one statement is a valid transition that claim-first would
  -- reject, because the registry would still show the old owner.
  SELECT array_agg('Category'::TEXT), array_agg(o."id"), array_agg(o."slug")
    INTO t, i, s FROM "oldtab" o;
  PERFORM "product_slug_release"(t, i, s);

  SELECT array_agg('Category'::TEXT), array_agg(n."id"), array_agg(n."slug")
    INTO t, i, s FROM "newtab" n;
  PERFORM "product_slug_claim"(t, i, s);
  RETURN NULL;
END $fn$;

CREATE FUNCTION "product_slug_tg_categories_del"() RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
DECLARE t TEXT[]; i UUID[];
BEGIN
  SELECT array_agg('Category'::TEXT), array_agg(o."id") INTO t, i FROM "oldtab" o;
  PERFORM "product_slug_release_owner"(t, i);
  RETURN NULL;
END $fn$;

CREATE FUNCTION "product_slug_tg_products_ins"() RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
DECLARE t TEXT[]; i UUID[]; s TEXT[];
BEGIN
  SELECT array_agg('Product'::TEXT), array_agg(n."id"), array_agg(n."slug")
    INTO t, i, s FROM "newtab" n;
  PERFORM "product_slug_claim"(t, i, s);
  RETURN NULL;
END $fn$;

CREATE FUNCTION "product_slug_tg_products_upd"() RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
DECLARE t TEXT[]; i UUID[]; s TEXT[];
BEGIN
  SELECT array_agg('Product'::TEXT), array_agg(o."id"), array_agg(o."slug")
    INTO t, i, s FROM "oldtab" o;
  PERFORM "product_slug_release"(t, i, s);

  SELECT array_agg('Product'::TEXT), array_agg(n."id"), array_agg(n."slug")
    INTO t, i, s FROM "newtab" n;
  PERFORM "product_slug_claim"(t, i, s);
  RETURN NULL;
END $fn$;

CREATE FUNCTION "product_slug_tg_products_del"() RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
DECLARE t TEXT[]; i UUID[];
BEGIN
  SELECT array_agg('Product'::TEXT), array_agg(o."id") INTO t, i FROM "oldtab" o;
  PERFORM "product_slug_release_owner"(t, i);
  RETURN NULL;
END $fn$;

-- Relevance — ADR-011 §7 — is applied here, in the body, over the transition
-- sets. A row is relevant iff field = 'slug' AND entity_type IN (Category,
-- Product); BlogPost, Segment and ProductType translations pass through
-- untouched, as do name and description rows for every entity.
CREATE FUNCTION "product_slug_tg_translations_ins"() RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
DECLARE t TEXT[]; i UUID[]; s TEXT[];
BEGIN
  SELECT array_agg(n."entity_type"), array_agg(n."entity_id"), array_agg(n."value")
    INTO t, i, s FROM "newtab" n
   WHERE n."field" = 'slug' AND n."entity_type" IN ('Category', 'Product');
  PERFORM "product_slug_claim"(t, i, s);
  RETURN NULL;
END $fn$;

-- The uniform rule: relevant OLD releases, relevant NEW claims, release first.
-- Because relevance is re-evaluated on each side independently, every transition
-- in ADR-011 §7's matrix falls out of these two statements — non-slug to slug,
-- slug to non-slug, entity-type changes in either direction, entity_id
-- reassignment, locale change, value change, and any combination.
CREATE FUNCTION "product_slug_tg_translations_upd"() RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
DECLARE t TEXT[]; i UUID[]; s TEXT[];
BEGIN
  SELECT array_agg(o."entity_type"), array_agg(o."entity_id"), array_agg(o."value")
    INTO t, i, s FROM "oldtab" o
   WHERE o."field" = 'slug' AND o."entity_type" IN ('Category', 'Product');
  PERFORM "product_slug_release"(t, i, s);

  SELECT array_agg(n."entity_type"), array_agg(n."entity_id"), array_agg(n."value")
    INTO t, i, s FROM "newtab" n
   WHERE n."field" = 'slug' AND n."entity_type" IN ('Category', 'Product');
  PERFORM "product_slug_claim"(t, i, s);
  RETURN NULL;
END $fn$;

CREATE FUNCTION "product_slug_tg_translations_del"() RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
DECLARE t TEXT[]; i UUID[]; s TEXT[];
BEGIN
  SELECT array_agg(o."entity_type"), array_agg(o."entity_id"), array_agg(o."value")
    INTO t, i, s FROM "oldtab" o
   WHERE o."field" = 'slug' AND o."entity_type" IN ('Category', 'Product');
  PERFORM "product_slug_release"(t, i, s);
  RETURN NULL;
END $fn$;

CREATE TRIGGER "product_slug_categories_insert"
  AFTER INSERT ON "categories" REFERENCING NEW TABLE AS "newtab"
  FOR EACH STATEMENT EXECUTE FUNCTION "product_slug_tg_categories_ins"();

CREATE TRIGGER "product_slug_categories_update"
  AFTER UPDATE ON "categories" REFERENCING OLD TABLE AS "oldtab" NEW TABLE AS "newtab"
  FOR EACH STATEMENT EXECUTE FUNCTION "product_slug_tg_categories_upd"();

CREATE TRIGGER "product_slug_categories_delete"
  AFTER DELETE ON "categories" REFERENCING OLD TABLE AS "oldtab"
  FOR EACH STATEMENT EXECUTE FUNCTION "product_slug_tg_categories_del"();

CREATE TRIGGER "product_slug_products_insert"
  AFTER INSERT ON "products" REFERENCING NEW TABLE AS "newtab"
  FOR EACH STATEMENT EXECUTE FUNCTION "product_slug_tg_products_ins"();

CREATE TRIGGER "product_slug_products_update"
  AFTER UPDATE ON "products" REFERENCING OLD TABLE AS "oldtab" NEW TABLE AS "newtab"
  FOR EACH STATEMENT EXECUTE FUNCTION "product_slug_tg_products_upd"();

CREATE TRIGGER "product_slug_products_delete"
  AFTER DELETE ON "products" REFERENCING OLD TABLE AS "oldtab"
  FOR EACH STATEMENT EXECUTE FUNCTION "product_slug_tg_products_del"();

CREATE TRIGGER "product_slug_translations_insert"
  AFTER INSERT ON "content_translations" REFERENCING NEW TABLE AS "newtab"
  FOR EACH STATEMENT EXECUTE FUNCTION "product_slug_tg_translations_ins"();

CREATE TRIGGER "product_slug_translations_update"
  AFTER UPDATE ON "content_translations" REFERENCING OLD TABLE AS "oldtab" NEW TABLE AS "newtab"
  FOR EACH STATEMENT EXECUTE FUNCTION "product_slug_tg_translations_upd"();

CREATE TRIGGER "product_slug_translations_delete"
  AFTER DELETE ON "content_translations" REFERENCING OLD TABLE AS "oldtab"
  FOR EACH STATEMENT EXECUTE FUNCTION "product_slug_tg_translations_del"();

-- ---------------------------------------------------------------------------
-- 7. Coverage assertion.
--
-- Both directions, not a count comparison: every distinct source key must be
-- claimed, and every claim must be backed by a source owned by the same entity.
-- A count check would pass on two errors that cancel.
-- ---------------------------------------------------------------------------
DO $assert$
DECLARE
  v_missing TEXT;
  v_extra   TEXT;
BEGIN
  SELECT string_agg(DISTINCT s."slug_key", ', ') INTO v_missing
    FROM "product_slug_sources"() s
   WHERE NOT EXISTS (
     SELECT 1 FROM "product_slug_claims" c
      WHERE c."slug_key"   = s."slug_key"
        AND c."owner_type" = s."owner_type"
        AND c."owner_id"   = s."owner_id"
   );

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'ADR-011 install aborted: source slugs left unclaimed after backfill: %', v_missing;
  END IF;

  SELECT string_agg(c."slug_key", ', ') INTO v_extra
    FROM "product_slug_claims" c
   WHERE NOT EXISTS (
     SELECT 1 FROM "product_slug_sources"() s
      WHERE s."slug_key"   = c."slug_key"
        AND s."owner_type" = c."owner_type"
        AND s."owner_id"   = c."owner_id"
   );

  IF v_extra IS NOT NULL THEN
    RAISE EXCEPTION 'ADR-011 install aborted: claims exist with no backing source: %', v_extra;
  END IF;
END
$assert$;

COMMIT;
