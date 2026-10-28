# ADR-030: Product classification is Admin-owned after the initial import

## Status

**Accepted, 28 October 2026.** The owner approved this on 28 October 2026, together with the
classification corrections in §4.

**Amends** ADR-015 (import identity) and the PRODUCT-DATA-2C-A ratification recorded in
`apps/api/src/modules/catalog/import/taxonomy-mapping.ts` (`RATIFIED_MARINE_GEAR_DECISIONS`).
ADR-007, ADR-008, ADR-020, ADR-026 and ADR-029 are unchanged.

## Context

- The ratified catalogue import (ADR-015) wrote every product's **Product Family**
  (`products.category_id`), **Product Type** (`products.product_type_id`) and **Segment
  memberships** (`product_segments`). A replay of that import compares those values with its plan,
  so a later change made anywhere else is reported as a conflict.
- Classification is a business decision, not a source fact. Segments and application groups are
  already edited in `/admin` (ADR-026, ADR-029), and the owner now needs to correct families and
  types as the catalogue is reviewed.
- PRODUCT-DATA-2C-A kept five gear and transmission rows (`ATF Grade`, `GL-5 Grade`, `GL-4 Grade`,
  `GL-3 Grade`, `GL-I Grade`) in Marine Oils & Lubricants because the Excel workbook files them
  there, while recording that their source catalogue section and API designations are automotive.
  On 28 October 2026 the owner reversed that decision.

## Decision

1. **Ownership.** After a product's first import, its Product Family, Product Type and Segment
   memberships are owned by `/admin` and by guarded operator scripts, not by the catalogue
   importer.
2. **Importer.** A replay of the catalogue import keeps comparing everything else it wrote
   (id, name, slug, source reference, grades, specifications, claims, provenance and review
   state), and stops comparing `category_id`, `product_type_id` and `product_segments` for a
   product that already exists. It still sets all three when it **creates** a product.
3. **Provenance stays.** `RATIFIED_MARINE_GEAR_DECISIONS` stays in the code as the record of what
   the import decided and why. It is not edited to match today's data, and it no longer decides
   the published family.
4. **Corrections approved with this ADR**, applied by a guarded, idempotent operator script that
   changes a value only when it still holds the expected old value:
   - **Family:** the five gear and transmission rows move from Marine Oils & Lubricants to
     Engine Oils & Automotive Lubricants, losing the `marine` Segment.
   - **Product Type:** `hydraulic-oil-hh-grade` and `hydraulic-oil-hl-grade` become
     `hydraulic-oils`; `extreme-pressure-ep`, `polyalphaolefin-pao` and `polyalkylene-glycol-pag`
     become `gear-oils`. Their published descriptions name them hydraulic and industrial gear oils.
   - **Segments added** (none removed except the five rows' `marine`):
     - gasoline passenger-car engine oils and automatic transmission fluids: `passenger-cars`
     - heavy-duty diesel engine oils: `trucks-buses`; the three CJ-4 and CK-4 products also
       `construction-mining` and `agriculture` (API scopes those categories to Tier 4 non-road
       engines)
     - GL-5 gear oils, the moved gear oils and both coolants: `passenger-cars` and `trucks-buses`
     - `locomotive-oil` and the lubricant additives: none
   - **Persian Product Type names**, closing that part of ADR-020's deferral: روغن موتور,
     روغن‌های صنعتی, افزودنی‌های روان‌کار, روغن دنده, روغن دریایی, روغن هیدرولیک, ضدیخ و ضدجوش,
     گریس — the wording Iranian lubricant makers use on their own sites (Iranol, Sepahan Oil);
     Lubricant Additives has no counterpart there and keeps the site's existing wording. Slugs
     are not translated. An existing Persian name is never overwritten.
5. **Audit.** Each changed product is audited as `product.taxonomy_changed`.

## Consequences

- Classification can be corrected without a new import plan or a patch kind for it.
- A replay of the ratified import no longer guards classification. The trade-off is deliberate:
  the importer guards source facts, and classification is not one.
- Editing Product Family and Product Type in the `/admin` product editor is the next
  implementation gate. Segments and application groups are already editable there.

## Alternatives considered

- **Change the import's own tables and apply through ADR-018 patches.** Rejected: ADR-018 has no
  reclassification patch kind, so it would need its own ADR, and every later correction would
  need a code change.
- **Change the database only.** Rejected: the next replay would report conflicts, and the code
  would still claim the old family.
