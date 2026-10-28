# ADR-029: Application groups within a Product Family

## Status

**Accepted, 28 October 2026.** The owner approved the redesigned Product Family page, which lists a
family's products grouped by the machine or application they serve (for Industrial Oils &
Lubricants: compressors, turbines, hydraulics, gears and synthetics, circulating, heat transfer,
metalworking, greases). Asked where that grouping should live — an Admin-managed field, Payload CMS,
or the existing Product Type — the owner chose an Admin-managed field. This ADR records that choice.

Nothing earlier is superseded. ADR-007, ADR-008, ADR-020 and ADR-026 are unchanged.

## Context

- **Segment** (ADR-007, ADR-008, ADR-026) is the market axis: who buys the product (Passenger Cars,
  Marine, Industry …). It is many-to-many and shared across families. Every product of Industrial
  Oils & Lubricants is in the one Segment `industry`, so it cannot split that family.
- **Product Type** (ADR-020) is a closed eight-value vocabulary of product kinds. It separates
  hydraulic, gear and grease products but has no value for compressors, turbines, heat transfer or
  metalworking, and adding a ninth value needs its own approval.
- The grouping the page needs is **per family** (an engine-oil family would group by vehicle, a
  marine family by engine or system), **single-valued** per product, and edited by the business
  as products are added. It is presentation of the catalogue, not editorial copy, so it belongs with
  the Prisma-owned catalogue, not in Payload (`PROJECT_HANDOFF.md` §6.7, §6.8).

## Decision

### 1. Schema

- New table `application_groups`:

  | Column        | Type                                             | Notes                                       |
  | ------------- | ------------------------------------------------ | ------------------------------------------- |
  | `id`          | uuid PK                                          |                                             |
  | `category_id` | uuid, FK → `categories.id`, `ON DELETE RESTRICT` | The one Product Family the group belongs to |
  | `slug`        | text, non-blank                                  | Unique within the family                    |
  | `name`        | text, non-blank                                  | Default-locale name                         |
  | `sort_order`  | int                                              | Display order within the family             |

  Unique `(category_id, slug)`.

- `products.application_group_id` — nullable uuid, FK → `application_groups.id`,
  `ON DELETE RESTRICT`. A trigger refuses a product whose group belongs to a different family, on
  insert and on update of either column, so a product can never sit in another family's group.
- Group names are localized through `content_translations` with entity type `ApplicationGroup`,
  field `name`, like Segment and Product Type names. Slugs are not localized.
- **Slugs are never URL path segments.** They are not part of the ADR-011 products-slug namespace
  and appear only as page fragments or UI state.

### 2. Public read

`GET /products` items and `GET /products/:slug` gain
`applicationGroup: { slug, name, sortOrder } | null`, localized in the request's locale. No new
endpoint and no new query parameter. The family page derives its groups from its products. A
product with no group is listed under "Other products" — vocabulary, not a row, exactly as ADR-008
§2 treats `Other`.

### 3. Writing

- **Create, rename, reorder and delete a group: Admin only**, audited as
  `application_group.created`, `application_group.updated` and `application_group.deleted`. A group
  that still has products cannot be deleted. This matches ADR-026 for Segments.
- **Assigning a product to a group: Admin and Content Manager**, from the product editor, audited as
  `product.application_group_changed`. This matches the existing Segment assignment in the same
  editor (ADR-024).
- **Initial data:** the eight Industrial Oils & Lubricants groups and their product assignments are
  loaded by a guarded operator script, dry run by default, idempotent, and writing only
  `application_groups` and `products.application_group_id`.

### 4. Not decided here

- A `group` filter on `GET /products`, or a Product Finder facet.
- Groups for the other five families. They are created in `/admin` when the business defines them.
- Any change to Segment or Product Type.

## Consequences

- One additive migration: a new table, a new nullable column and a trigger. Rollback drops both.
- The family page can be grouped and ordered by the business without a code change.
- Two taxonomies now describe a product (Segment for the market, application group for the
  machine), each single-purpose.

## Alternatives considered

- **Payload CMS lists per family.** Rejected by the owner: product membership would live in two
  systems and drift.
- **Product Type.** Rejected: a closed vocabulary that cannot express compressors or turbines.
- **Reuse Segment.** Rejected: Segment is the market axis and is shared across families.

## Implementation gates

1. **Database:** migration and Prisma model.
2. **Backend:** public read, Admin endpoints, audit events, tests.
3. **Frontend:** the redesigned Product Family and Product Detail pages, the Admin screens.
4. **Operations:** the guarded script for the initial Industrial Oils & Lubricants groups.
