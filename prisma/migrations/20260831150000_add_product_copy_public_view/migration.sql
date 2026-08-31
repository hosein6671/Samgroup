-- ADR-019 §5 · The sanctioned public read model for product copy.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- Why this is a view and not a WHERE clause in the service
-- ─────────────────────────────────────────────────────────────────────────────
--
-- ADR-014 §8 fixed the pattern: what the public may read is defined once, in the
-- database, as a view — `v_specification_public` and `v_product_claim_public`.
-- The review service's step 10 then asks THAT view, inside the decision
-- transaction, whether the row it just approved is now visible, and aborts the
-- whole transaction if the view disagrees with the decision.
--
-- Without this view the third subject would have to skip step 10, which is
-- exactly the check that catches "the service believes this is published" not
-- matching "the surface that publishes it says so".
--
-- ─────────────────────────────────────────────────────────────────────────────
-- The three conditions, and the one that is not on the other two views
-- ─────────────────────────────────────────────────────────────────────────────
--
-- `approved` and `deleted_at IS NULL` are the same two the other views apply.
--
-- The locale join is new, because copy is the only subject with a locale. A
-- sentence written for a locale the site no longer serves must not be published
-- through a route that no longer exists, and the locale list is DATA (a `Locale`
-- table, never code — PROJECT_HANDOFF §6.9), so deactivating a language is an
-- ordinary editorial act that must take its copy out of the public read model
-- without a code change.
--
-- Note what this does NOT do: deactivating a locale does not un-approve
-- anything. The review stands, the row keeps its status, and reactivating the
-- locale publishes it again. Visibility and approval are different questions and
-- this view answers only the first.

CREATE VIEW "v_product_copy_public" AS
SELECT pc."id",
       pc."product_id",
       pc."locale",
       pc."summary",
       pc."selection_note"
  FROM "product_copy" pc
  JOIN "locales" l ON l."code" = pc."locale" AND l."is_active"
 WHERE pc."review_status" = 'approved'::technical_review_status
   AND pc."deleted_at" IS NULL;

COMMENT ON VIEW "v_product_copy_public" IS
  'ADR-019 §5. Approved, live product copy in an active locale — the only sanctioned public read '
  'model for editorial product copy. Deactivating a locale withdraws its copy from here without '
  'changing any review status.';
