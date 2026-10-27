-- ADR-028: an optional public display label for a ProductGrade.
--
-- `label` stays the verbatim source label (ADR-014) and remains the import identity
-- (ADR-015). `display_label` is presentation only: NULL means "show `label`".
ALTER TABLE "product_grades"
  ADD COLUMN "display_label" VARCHAR(100),
  ADD CONSTRAINT "product_grades_display_label_not_blank"
    CHECK ("display_label" IS NULL OR btrim("display_label") <> '');

-- Two grades of one product must never render with the same public label.
CREATE UNIQUE INDEX "product_grades_product_id_shown_label_key"
  ON "product_grades" ("product_id", (COALESCE("display_label", "label")));
