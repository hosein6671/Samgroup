# ADR-028: A public display label for Product Grades

## Status

**Accepted, 28 October 2026.** On 27 October 2026 the owner asked for the `Turbine oil` grade labels
`HSB-T-32` … `HSB-T-68 plus` to be shown as `T-32` … `T-68 plus` (the `HSB-` prefix removed, nothing
else changed). This ADR is how that can be done without breaking ADR-014 or ADR-015. Approved by the
owner on 28 October 2026.

**Implementation notes (28 October 2026):** the one-off operator script of §4 is implemented as
`pnpm catalog:grades:relabel` (dry run by default; `--apply` needs `SAM_ALLOW_GRADE_RELABEL=true` and
`--confirm-target sam_platform`). It finds the product by slug `turbine-oil` and name `Turbine oil`,
and refuses unless exactly seven `HSB-` grades exist. The Admin endpoint
`PATCH /admin/products/:id/grades/:gradeId`, and showing both labels on review screens, are not
implemented yet.

## Context

- **ADR-014** stores `ProductGrade.label` verbatim: "The exact label the source states." The
  `HSB-T-*` labels are exactly what the supplied catalogue prints, so the stored values are correct
  as source records.
- **ADR-015** makes the importer's identity deterministic. `(product_id, label)` is unique, grade
  ids are derived from the label, and an identical replay of the ratified import must find the same
  rows. Rewriting `label` in place would make a replay plan a different grade and fail as a
  conflict.
- **ADR-018** registers bounded patches that add normalized Specifications. Renaming an existing
  row is not a patch kind it allows.
- The public detail response serves `grades[].label`, and `specifications[].grade.label`, directly,
  so the third-party prefix is visible on `samgp.com` today.

The requirement — a public name that differs from the source label — therefore needs a field of
its own.

## Decision

1. **Schema.** Add a nullable column to `product_grades`:
   - `display_label varchar(100)`
   - a CHECK constraint that it is either NULL or non-blank after trimming

   `label` keeps its meaning (verbatim source text), its uniqueness and its role in import identity.

2. **Public read.** The catalog API serves `displayLabel ?? label` wherever it serves a grade label:
   the grade list, the grade attached to a specification, and the grade attached to a claim. The
   wire field name stays `label`, so no frontend contract changes. Admin and review screens show
   both values.
3. **Uniqueness of what the public sees.** A partial unique index on
   `(product_id, coalesce(display_label, label))` stops two grades of one product from showing the
   same name.
4. **Writing it.** Admin only, through a narrow endpoint `PATCH /admin/products/:id/grades/:gradeId`
   with `displayLabel` and the product revision. The change is audited as `product.grade_relabelled`.
   For this specific request, a one-off operator script may set the seven rows instead. It must be
   idempotent and run in dry-run first, and it may write only `display_label` on the seven named
   grade ids.
5. **No other effects.**
   - No review hash includes `display_label`, so approvals are not invalidated and published
     Specifications stay public.
   - SourceFacts, provenance and the importer are untouched.
   - An identical replay of the ratified import remains identical.

## Consequences

- The `HSB-` prefix disappears from the public site, while the source record still says what the
  source printed.
- Any later presentational correction of a grade name (for example `Iso-68` → `ISO VG 68`) uses
  the same field rather than rewriting source text.
- One additive migration, small API projection changes, and their tests.

## Alternatives considered

- **Rewrite `product_grades.label`.** Rejected: it contradicts ADR-014's verbatim rule and breaks
  ADR-015's identical replay.
- **Strip prefixes in the API or frontend by rule.** Rejected: a hard-coded string rule is hidden
  data editing, and it would silently apply to any future label that happens to match.
- **Delete and re-create the grades.** Rejected: Specifications and claims reference the grade ids
  with `ON DELETE RESTRICT`, and re-creation would detach their approval history.

## Implementation gates (each needs its own approval)

1. **Database:** migration adding `display_label`, its CHECK and the partial unique index.
2. **Backend:**
   - the projection change in `ProductsService`
   - the Admin endpoint and its audit event
   - tests showing that approvals and public rows are unchanged
3. **Operations:** set the seven `Turbine oil` display labels on the VPS, dry-run first.
