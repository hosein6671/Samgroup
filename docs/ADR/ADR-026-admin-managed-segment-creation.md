# ADR-026: Admin-Managed Segment Creation — Closing ADR-008 §7's Deferral

## Status

Accepted, 17 September 2026. Owner authorized this decision directly in conversation, in response to a reported gap: the Product Finder's Segment filter has no path for adding a Segment other than editing `prisma/seed-catalog.ts` and re-running the seed script, which no one but a developer with repository access can do.

Closes the deferral [ADR-008](./ADR-008-b2-filter-contract-and-segment-vocabulary.md) §7 opened and left open on its own terms: _"Admin/API writes — the correct long-term home, but no catalog write endpoint exists, and adding one means new routes plus RBAC entries in `SECURITY.md`'s matrix. Deferred, not rejected on principle."_ This is that decision. **ADR-008 is not modified** — its Decision stands exactly as accepted; this ADR closes one of its own named deferrals through the decision chain, exactly as ADR-011 closed ADR-010 §6.

**This ADR authorizes implementation**, scoped to what is written below — unlike ADR-011, which was a pure decision document. The Non-Goals section is exact about what is still out of scope.

## Context

ADR-008 approved eight Segment names and slugs (§1) as a **closed, curated list**, populated only by `prisma/seed-catalog.ts` — an idempotent script a developer runs by hand (§7). It explicitly rejected "Admin/API writes" as the _initial_ mechanism only because no write endpoint or RBAC entry existed yet at the time, not because the idea was wrong; §7 names it "the correct long-term home."

Nothing else ADR-008 decided is in question:

- **§2 — `Other` is vocabulary, not a row.** Unaffected. This ADR adds no path to persist an `Other` Segment; see Non-Goals.
- **§3/§4 — the `GET /products?segment=` filter contract.** Unaffected. A new Segment row becomes filterable through the exact same resolution rules already implemented; no contract change.
- **§5 — `industry` retirement.** Unaffected.

What ADR-008 left unanswered is who can grow the list, and how. Today the answer is "a developer, by editing a TypeScript array and redeploying" — which is why the Admin panel's Segment filter looked, from the owner's side, like it "does nothing": there was no button, because there was no endpoint for a button to call.

## Decision

**Admin (role `ADMIN` only) may create a new Segment from `/admin`.** Content Manager and Sales Expert get no access, matching `SECURITY.md`'s existing default for catalog writes — ADR-024 loosened that default only for "ordinary catalogue editorial content and SEO," and a taxonomy row a public filter and every future Segment/Product Type membership hangs off is not ordinary editorial content.

### Scope: create and list, nothing else

- **`GET /admin/catalog/segments`** — Admin-authenticated list of every persisted Segment (`id`, `name`, `slug`, `sortOrder`, and a product count for context), sorted by `sortOrder`. Needed so the admin can see what already exists before adding a near-duplicate.
- **`POST /admin/catalog/segments`** — Admin-authenticated create. Body: `{ name: string }`. The slug is derived from `name` server-side (ASCII-folded, lower-cased, hyphenated — the same deterministic transform `slugifyProductName` already uses for Products, reimplemented locally since `Segment.slug` is not part of the ADR-011 products-slug-claim namespace: ADR-008 §1 states "`Segment.slug` and `Category.slug` are unique on separate tables, so the two axes share no uniqueness surface at all"). `sortOrder` is assigned as `max(existing) + 1` — appended to the end of the list, never renumbering existing rows.
- **Validation, server-side:**
  - `name`: required, trimmed, 1–60 characters.
  - Derived slug: must be non-empty after folding (reject with a clear message if a name folds to nothing — e.g. a name that is only punctuation).
  - Derived slug **must not equal `other`** — this directly re-affirms ADR-008 §2 rather than reopening it: the one thing this endpoint must never do is let an admin create the persisted "Other" row ADR-008 deliberately refused to create.
  - Derived slug must be unique against existing `Segment.slug` (the column is already `@unique` in `prisma/schema.prisma`; the service layer catches the constraint violation and returns a 409 naming the collision, rather than a raw Prisma error).

### Explicitly out of scope for this increment

- **No rename or delete of an existing Segment** — including the eight ADR-008 approved. A Segment already has `ProductSegment` and `SegmentProductType` memberships once real catalog data uses it (per this session's own investigation: `marine` alone carries twelve); renaming or deleting safely is a separate decision with its own consequences (cascading membership loss, stale translations, stale SEO) and is not authorized here.
- **No reordering UI** for existing rows in this increment. `sortOrder` is read-only except for the append-to-end behavior on create.
- **No Product Type equivalent.** ADR-020 governs Product Type vocabulary separately; this ADR touches Segment only.
- **No public write surface.** Every route above requires an authenticated Admin session (`JwtAuthGuard` + `RolesGuard`, the same pattern `ProductEditorController` already uses).
- **No translation of the new Segment's name.** It is created in the default locale only, exactly as `seed-catalog.ts`'s rows are today; translating a Segment name is unaffected existing infrastructure (`ContentTranslation`), usable later without a schema change, but not wired into this create form.

## Implementation boundary

- **Backend** (`apps/api/src/modules/catalog`): a new `segments.controller.ts` / `segments.service.ts` pair (or, if smaller in practice, additions to the existing `catalog.module.ts` wiring) — `@Controller("admin/catalog/segments")`, `@UseGuards(JwtAuthGuard, RolesGuard)`, `@Roles(UserRole.ADMIN)`, mirroring `ProductEditorController`'s shape.
- **Frontend** (`apps/web/src/app/(admin)/admin/catalog/segments`): a new Admin page — a list of existing Segments (name, slug, product count) plus a single-field "Add segment" form, styled with the `.ad-*` design system this session's Admin redesign established (Phase 1–3), not the public `.fs-*` vocabulary.
- **`prisma/seed-catalog.ts` is unaffected and keeps running.** It remains the mechanism for the eight ADR-008 rows and continues to upsert idempotently by slug; this ADR adds a second, admin-facing path for rows _beyond_ those eight, and the two do not conflict because both key on the same unique `slug` column.
- **`docs/API_CONTRACT_FINAL.md`** gains the two new endpoints under the existing Admin/Catalog section, following that document's existing format.

## Non-Goals

Accepting this ADR authorizes exactly the create-and-list surface described above. It does **not** authorize:

- persisting an `Other` Segment (ADR-008 §2 stands; enforced by validation, not merely by convention)
- renaming or deleting any Segment, approved or admin-created
- any change to the `GET /products?segment=` public filter contract
- a Product Type equivalent
- any Payload/CMS change
- any change to `prisma/seed-catalog.ts`'s own approved-eight list or its upsert behavior

## Consequences

**Positive**

- Closes a real, reported gap: the owner can grow the Segment list without a developer edit-and-redeploy cycle.
- Costs no schema change — `Segment` already has every column this needs.
- Cannot silently violate ADR-008 §2, because the "Other" name is rejected by the same validation path every other name goes through, not by a separate carve-out that could be forgotten.
- Follows exactly the RBAC and controller shape `ProductEditorController`/ADR-024 already established, so it introduces no second pattern for Admin-authenticated catalog writes.

**Negative**

- **Two mechanisms now create Segment rows** (the seed script and this endpoint), and a future reader must know both exist. Mitigated by both keying on the same unique `slug` column, so neither can silently shadow the other.
- **An admin can create a Segment with no products and no plan to add any** — nothing here validates that a new Segment will ever be used. Accepted: the same is true of the eight approved Segments before catalog data existed for them, and ADR-008 §6 already treats "a filter with an empty table" as an expected transient state, not an error.
- **No rename/delete path** means a typo'd Segment name is permanent without a developer's help — a deliberate, narrower increment rather than a fuller CRUD surface, per this session's task-scope discipline.

## Alternatives Considered

- **Full CRUD (create, rename, delete, reorder) in one increment.** Rejected for this pass — delete in particular needs a decision about what happens to existing `ProductSegment`/`SegmentProductType` memberships and is exactly the kind of decision ADR-008 itself deferred rather than made lightly. Create-only closes the reported gap without pre-deciding that harder question.
- **Allow Content Manager to create Segments, matching ADR-024's loosening for editorial content.** Rejected — a Segment is taxonomy structure that every future Product's filterability depends on, not "ordinary catalogue editorial content and SEO," which is the specific carve-out ADR-024 made.
- **Let the admin type the slug directly instead of deriving it from the name.** Rejected for consistency: every other slug-bearing entity in this codebase (Products, Categories) derives its slug from a human-entered name rather than taking one directly, and a hand-typed slug reopens exactly the kind of drift ADR-008 §1 avoided by adopting existing published sub-range ids verbatim.
