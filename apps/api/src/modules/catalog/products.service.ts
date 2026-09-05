import { HttpStatus, Injectable } from "@nestjs/common";

import { ContentEntityType } from "../../common/content/content-entity-type";
import { ContentTranslationService } from "../../common/content/content-translation.service";
import { ApiException } from "../../common/http/api.exception";
import { ErrorCode } from "../../common/http/error-code";
import { PrismaService } from "../../prisma/prisma.service";
import { TechnicalReviewStatus } from "../../prisma/generated/enums";
import { MediaService } from "../media/media.service";
import { SeoService } from "../seo/seo.service";

import { CATEGORY_SELECT, CATEGORY_TRANSLATED_FIELDS } from "./categories.service";
import { DEFAULT_LIMIT, DEFAULT_PAGE, DEFAULT_SORT } from "./dto/product-list.query";

import type { ProductListQuery, ProductSort } from "./dto/product-list.query";
import type {
  ProductDetailResponse,
  ProductListItemResponse,
  ProductSpecificationResponse,
} from "./dto/product.response";
import type { ResolvedLocale } from "../../common/locale/resolved-locale";
import type { Prisma } from "../../prisma/generated/client";

const NOT_FOUND_MESSAGE = "Product not found.";
const UNKNOWN_CATEGORY_MESSAGE = "The requested category filter does not match a category.";
const UNKNOWN_CATEGORY_ISSUE = "must be the slug of an existing category in the requested locale";
const UNKNOWN_SEGMENT_MESSAGE = "The requested segment filter does not match a segment.";
const UNKNOWN_SEGMENT_ISSUE = "must be the slug of an existing segment in the requested locale";
const UNKNOWN_PRODUCT_TYPE_MESSAGE =
  "The requested productType filter does not match a product type.";
const UNKNOWN_PRODUCT_TYPE_ISSUE =
  "must be the slug of an existing product type in the requested locale";

/**
 * The `content_translations.field` values this module translates for a product. All three are
 * columns on `products`, which is what makes them translatable: the base row holds the default
 * locale and every other locale is a row in `content_translations`.
 */
const PRODUCT_TRANSLATED_FIELDS = ["name", "slug", "description"] as const;

/**
 * The translated fields `?q=` searches — the localized counterpart of the base-row match, and
 * deliberately the same two fields the contract names for the base row (§2.7: "q matches
 * product name, slug, and specification values"). `description` is excluded from search on
 * both sides so the two halves cannot disagree about what a hit means.
 */
const PRODUCT_SEARCHABLE_FIELDS = ["name", "slug"] as const;

/**
 * The translated fields of the two taxonomy axes the detail response carries. Both are
 * `name`/`slug` and both are listed separately rather than shared, because they name columns on
 * two different tables and one gaining a translatable column must not silently widen the other.
 *
 * `Segment.sortOrder` is not here and could not be: `content_translations.value` is text, and
 * an ordering that differed per locale would reorder the same page in two languages.
 */
const SEGMENT_TRANSLATED_FIELDS = ["name", "slug"] as const;
const PRODUCT_TYPE_TRANSLATED_FIELDS = ["name", "slug"] as const;

const PRODUCT_SELECT = {
  id: true,
  name: true,
  slug: true,
  description: true,
  categoryId: true,
  createdAt: true,
} as const;

/**
 * The ONLY condition under which a `Specification` is public.
 *
 * ── Why this exists at all ──────────────────────────────────────────────────
 *
 * When this endpoint shipped, every `specifications` row was hand-seeded demo data, so
 * "return them all" and "return the approved ones" described the same set and the endpoint
 * chose the first. The catalog import ends that: it writes 1,398 rows, every one of them
 * `SOURCE_RECORDED` or `NEEDS_REVIEW`, and none of them fit to publish. Without this predicate
 * the first successful import would publish the entire unreviewed technical catalogue through
 * a route nobody changed.
 *
 * ── Approved, and still live ────────────────────────────────────────────────
 *
 * Both halves are required and neither implies the other. `reviewStatus` is a decision a human
 * recorded; `deletedAt` is whether the row is still current. An approved row that was later
 * retired is not public, and a live row nobody approved never was.
 *
 * `SOURCE_RECORDED`, `NEEDS_REVIEW`, `REJECTED` and `SUPERSEDED` are all excluded by naming
 * `APPROVED` positively rather than by listing what to hide: a status added to the enum later
 * is non-public by default, which is the safe direction for a list of things to publish.
 *
 * ── At the query boundary, never in JavaScript ──────────────────────────────
 *
 * Applied inside `where`, so PostgreSQL never returns an unapproved row to this process. A
 * fetch-then-filter would put unpublished technical data in a response object one careless
 * spread away from the wire, and would make `?q=` an oracle for values nobody approved.
 *
 * ── What is NOT re-checked here, and why ────────────────────────────────────
 *
 * "The grade belongs to this product" is not a predicate this file can weaken or forget:
 * `specifications_product_grade_id_product_id_fkey` is a COMPOSITE foreign key on
 * `(product_grade_id, product_id)`, so a Specification citing another Product's grade cannot
 * exist to be selected. This mirrors `v_specification_public` (ADR-014), which remains the
 * sanctioned read model; the two are deliberately the same rule stated in the two places a
 * reader could arrive from.
 */
const PUBLIC_SPECIFICATION_WHERE = {
  reviewStatus: TechnicalReviewStatus.APPROVED,
  deletedAt: null,
} as const satisfies Prisma.SpecificationWhereInput;

/**
 * Every column `GET /products/:slug` and the partial-refresh route are allowed to read off an
 * approved `Specification` row — the same allow-list `v_specification_public` (ADR-014 §8)
 * already enforces at the database, read here through the base table under
 * `PUBLIC_SPECIFICATION_WHERE` rather than through the view itself, because Prisma has no model
 * for a view and the `where` predicate above is the one the view encodes. Every field below is
 * named in that view's own column list — nothing here widens the allow-list; this file is
 * simply the first caller to read the rest of it.
 *
 * `displayValue`, `qualifier`, `valueType`, `numericMin`, `numericMax`, `pairFirst`, `pairSecond`
 * and `productGrade` are the additions beyond what shipped originally (`id`/`key`/`value`/
 * `unit`/`method`/`resultBasis`/grade). None is a new column — all have existed on
 * `Specification` since ADR-014 — this is the first read path to select the rest of them.
 * `propertyKey` and every provenance column (`reviewStatus`, timestamps, evidence, source) are
 * deliberately absent, exactly as they are absent from the view: `SpecProperty.canonicalMeaning`
 * is documented as "not a public label", so the internal dictionary key stays off the wire and
 * `key` remains the only property label served, unchanged from what already ships. `sortOrder`
 * is in the view but not selected here — this route already has a stable order from `orderBy`,
 * and exposing a second, unused ordering hint would be a field with no caller.
 */
const PUBLIC_SPECIFICATION_SELECT = {
  id: true,
  key: true,
  value: true,
  displayValue: true,
  unit: true,
  method: true,
  qualifier: true,
  resultBasis: true,
  valueType: true,
  numericMin: true,
  numericMax: true,
  pairFirst: true,
  pairSecond: true,
  productGrade: { select: { label: true, gradeSystem: true } },
} as const satisfies Prisma.SpecificationSelect;

/** The raw shape `PUBLIC_SPECIFICATION_SELECT` produces, before `toSpecificationResponse`. */
type PublicSpecificationRow = Prisma.SpecificationGetPayload<{
  select: typeof PUBLIC_SPECIFICATION_SELECT;
}>;

/**
 * A `Decimal` as text, never as a JavaScript number — `numeric(20,6)` does not fit in a double,
 * and a specification limit that changes when it is round-tripped is not a limit. The same
 * reasoning and the same shape as `catalog-review.service.ts`'s private `decimalString`; kept as
 * its own copy here rather than imported, because that file is the Admin review surface and this
 * one is the public catalog read path — two independent projections of the same column, which is
 * also why each already shapes its own response type rather than sharing one.
 */
function decimalString(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

/**
 * Resolves one raw `Specification` row into the wire shape — the one place `displayValue` is
 * preferred over the legacy `value`, `productGrade` is flattened into `grade`, and every enum
 * column is lowercased to match the wire convention `catalog-review.service.ts` already
 * established for the same columns.
 *
 * `displayValue` is only ever set on a row a reviewer approved through the normalized path
 * (ADR-014 §3); every legacy row has it `null`, so the fallback is not a special case, it is the
 * only case that ever runs for data imported before this gate. The same CHECK
 * (`specifications_normalized_complete`) that requires `displayValue` on a typed row is why
 * `value` is never reconstructed from `numericMin`/`numericMax`/`pairFirst`/`pairSecond` here —
 * `displayValue` is already guaranteed correct wherever those columns are non-null.
 */
function toSpecificationResponse(row: PublicSpecificationRow): ProductSpecificationResponse {
  return {
    id: row.id,
    key: row.key,
    value: row.displayValue ?? row.value,
    unit: row.unit,
    method: row.method,
    qualifier: row.qualifier,
    resultBasis: row.resultBasis.toLowerCase() as ProductSpecificationResponse["resultBasis"],
    valueType:
      row.valueType === null
        ? null
        : (row.valueType.toLowerCase() as ProductSpecificationResponse["valueType"]),
    numericMin: decimalString(row.numericMin),
    numericMax: decimalString(row.numericMax),
    pairFirst: decimalString(row.pairFirst),
    pairSecond: decimalString(row.pairSecond),
    grade:
      row.productGrade === null
        ? null
        : {
            label: row.productGrade.label,
            gradeSystem:
              row.productGrade.gradeSystem === null
                ? null
                : (row.productGrade.gradeSystem.toLowerCase() as NonNullable<
                    ProductSpecificationResponse["grade"]
                  >["gradeSystem"]),
          },
  };
}

const PRODUCT_DETAIL_SELECT = {
  id: true,
  name: true,
  slug: true,
  description: true,
  createdAt: true,
  category: { select: CATEGORY_SELECT },
  // The PRIMARY Product Type, single-valued in v2 (ADR-007 §4) and nullable while no
  // ProductType row is approved. `id` is selected for localization only and is stripped before
  // the response — see toTaxonomyRef.
  productType: { select: { id: true, name: true, slug: true } },
  segments: {
    // `Segment.sortOrder` is the publishing order, and `Segment.id` behind it is what makes two
    // requests for the same product emit the same array: `sortOrder` carries no uniqueness
    // constraint, so two Segments may legitimately share one.
    orderBy: [{ segment: { sortOrder: "asc" } }, { segment: { id: "asc" } }],
    select: { segment: { select: { id: true, name: true, slug: true } } },
  },
  specifications: {
    // Approved and live only. A product whose technical data has been imported but not yet
    // reviewed serves an EMPTY array here, which is the truthful answer: the platform holds
    // no published specification for it yet.
    where: PUBLIC_SPECIFICATION_WHERE,
    // `specifications` has no ordering column and no unique on (product_id, key) — a product
    // may legitimately repeat a key, one row per grade. Ordering by key then value is what
    // makes the response stable across requests rather than left to insertion order.
    orderBy: [{ key: "asc" }, { value: "asc" }],
    select: PUBLIC_SPECIFICATION_SELECT,
  },
} as const satisfies Prisma.ProductSelect;

/**
 * Every sort carries `id` as a tiebreaker. Without it, two products sharing a name — or a
 * `createdAt`, which a bulk import makes likely — can order differently between two queries,
 * and a row then appears on both page 1 and page 2 or on neither.
 */
const PRODUCT_ORDER_BY: Record<ProductSort, Prisma.ProductOrderByWithRelationInput[]> = {
  name: [{ name: "asc" }, { id: "asc" }],
  "-name": [{ name: "desc" }, { id: "asc" }],
  createdAt: [{ createdAt: "asc" }, { id: "asc" }],
  "-createdAt": [{ createdAt: "desc" }, { id: "asc" }],
};

/** A product row as selected for the list, before localization — default-locale values. */
type ProductRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  categoryId: string;
  createdAt: Date;
};

type LocalizedProductList = {
  products: ProductListItemResponse[];
  total: number;
  /** The page actually served, after defaults — the controller echoes it into `meta`. */
  page: number;
  limit: number;
  localeFallback: boolean;
};

type LocalizedProduct = {
  product: ProductDetailResponse;
  localeFallback: boolean;
};

/**
 * A Segment or a ProductType as selected for the detail response. `id` is carried because
 * `content_translations` keys on it; it never reaches the wire.
 */
type TaxonomyRow = {
  id: string;
  name: string;
  slug: string;
};

/** LocalizedRows' single-row counterpart, for a relation that is at most one row. */
type LocalizedTaxonomyRow = {
  row: TaxonomyRow | null;
  localeFallback: boolean;
};

/**
 * A filter control submits itself even when the user left it blank, so `?q=&category=` is an
 * unfiltered list rather than a malformed request. Trimming here — not in the DTO — keeps the
 * validation layer describing shape and this layer describing meaning.
 */
function normalizeFilter(value: string | undefined): string | undefined {
  const trimmed = value?.trim();

  return trimmed === undefined || trimmed === "" ? undefined : trimmed;
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly translations: ContentTranslationService,
    private readonly seo: SeoService,
    private readonly media: MediaService,
  ) {}

  /**
   * The Product Finder's backend — API_CONTRACT_FINAL.md §2.7.
   *
   * Sorting by `name` orders by the DEFAULT locale's name, not the requested locale's:
   * translated names live in another table, so ordering by them would mean sorting in memory
   * after the page has already been chosen — which would make page 2 a different set of rows
   * than the sort implies. The order is therefore stable across locales rather than
   * alphabetical within each one. The same trade-off is already made by the category list.
   */
  async findAll(locale: ResolvedLocale, query: ProductListQuery): Promise<LocalizedProductList> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const sort = query.sort ?? DEFAULT_SORT;
    const where = await this.buildWhere(query, locale);

    // Both statements read the same snapshot-per-statement, so a concurrent insert can leave
    // `total` one ahead of the rows — acceptable for a catalog list, and the alternative
    // (an interactive transaction) holds a connection open on a public endpoint.
    const [total, rows] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy: PRODUCT_ORDER_BY[sort],
        skip: (page - 1) * limit,
        take: limit,
        select: PRODUCT_SELECT,
      }),
    ]);

    const { rows: localized, localeFallback } = await this.translations.localize(
      ContentEntityType.Product,
      rows,
      PRODUCT_TRANSLATED_FIELDS,
      locale,
    );

    /*
     * The approved copy overlays the column, and it does so AFTER localization on purpose.
     *
     * `description` is a translated field, so `localize` may already have written a
     * `ContentTranslation` value into it. ADR-019 §2 makes the approved row the authority —
     * `products.description` becomes a projection of it rather than an independently editable
     * field — so a reviewed sentence must not be overwritten by an unreviewed translation.
     */
    const copy = await this.approvedCopy(
      localized.map((row) => row.id),
      locale,
    );

    return {
      products: localized.map((row) =>
        toListItem({ ...row, description: copy.get(row.id) ?? row.description }),
      ),
      total,
      page,
      limit,
      localeFallback,
    };
  }

  /**
   * One product with its category, specifications and public images — §2.3.
   *
   * `:slug` is the locale-specific slug: the translated slug is tried first and the row's own
   * slug second, so a product with no translated slug is still reachable in that locale at its
   * default-locale path (§3's fallback rule).
   *
   * This endpoint — and not the list — carries `SeoFields` (§2.3), read through SeoService so
   * `seo_meta` is queried by the module that owns it.
   */
  async findBySlug(slug: string, locale: ResolvedLocale): Promise<LocalizedProduct> {
    const row = await this.findDetailBySlug(slug, locale);

    if (row === null) {
      // The slug is caller-supplied text and §8 contracts `message` as safe to display, so it
      // is not echoed back.
      throw new ApiException(HttpStatus.NOT_FOUND, ErrorCode.NotFound, NOT_FOUND_MESSAGE);
    }

    // `segments` and `productType` are pulled out of the rest spread deliberately: what follows
    // hands `product` to localize as a Product row, and a nested relation riding along in it
    // would be a shape the translation overlay never asked for.
    const { category, specifications, segments, productType, ...product } = row;

    const [localizedProduct, localizedCategory, localizedSegments, localizedProductType, images] =
      await Promise.all([
        this.translations.localize(
          ContentEntityType.Product,
          [product],
          PRODUCT_TRANSLATED_FIELDS,
          locale,
        ),
        this.translations.localize(
          ContentEntityType.Category,
          [category],
          CATEGORY_TRANSLATED_FIELDS,
          locale,
        ),
        // Flattened off the join rows first: `content_translations` keys on the SEGMENT's id,
        // and ProductSegment carries no id of its own to key on.
        this.translations.localize(
          ContentEntityType.Segment,
          segments.map((membership) => membership.segment),
          SEGMENT_TRANSLATED_FIELDS,
          locale,
        ),
        this.localizeProductType(productType, locale),
        // Product imagery is read through MediaService, not `prisma.media`: `media` belongs to
        // the Media module and ARCHITECTURE.md §Modules routes cross-module access through the
        // owning module's service. The `type = image` filter that keeps COA/SDS/TDS out of a
        // public gallery lives there too, where no caller can widen it.
        this.media.findImagesForOwner(ContentEntityType.Product, product.id),
      ]);

    // `?? product` / `?? category` are the untranslated rows, not placeholders: localize
    // returns its input one-for-one, so these only satisfy noUncheckedIndexedAccess.
    const translated = localizedProduct.rows[0] ?? product;

    /*
     * The approved editorial copy, overlaid before SEO reads the description (ADR-019 §5).
     *
     * Order matters twice over. It is after localization, so a reviewed sentence is not overwritten
     * by an unreviewed `ContentTranslation`; and it is before `seo.buildFor`, because §11 falls
     * the meta description back to the entity's description — a page whose meta description
     * disagreed with the paragraph beneath it would describe a different product to a search engine
     * than to a reader.
     *
     * Absent for every product with no approved copy, which is all of them until a reviewer
     * approves one. That path leaves `description` exactly as it is today.
     */
    const copy = await this.approvedCopy([product.id], locale);
    const description = copy.get(product.id) ?? translated.description;

    // Sequential rather than folded into the Promise.all above, because §11 falls the meta
    // title back to the entity's name and the meta description to its description — both of
    // which must be the REQUESTED locale's values, so the overlay has to have happened first.
    const seo = await this.seo.buildFor(
      {
        entityType: ContentEntityType.Product,
        entityId: product.id,
        // `product.slug`, not `translated.slug`: the default locale's alternate is the base
        // column, and localization may already have overlaid a translated slug onto the copy.
        defaultSlug: product.slug,
        fallbackTitle: translated.name,
        fallbackDescription: description,
      },
      locale,
    );

    return {
      product: {
        id: translated.id,
        name: translated.name,
        slug: translated.slug,
        description,
        createdAt: translated.createdAt.toISOString(),
        category: localizedCategory.rows[0] ?? category,
        // `id` is dropped here and not earlier: it is what localize keys on, and what nothing
        // downstream of the response has any use for.
        segments: localizedSegments.rows.map(toTaxonomyRef),
        productType:
          localizedProductType.row === null ? null : toTaxonomyRef(localizedProductType.row),
        specifications: specifications.map(toSpecificationResponse),
        images,
        seo,
      },
      // Every localized part of the response feeds the flag, taxonomy included: §3 has it
      // describe what was served, and a Segment name served in English inside a Persian
      // response is exactly the case the frontend's "not yet translated" notice exists for.
      localeFallback:
        localizedProduct.localeFallback ||
        localizedCategory.localeFallback ||
        localizedSegments.localeFallback ||
        localizedProductType.localeFallback,
    };
  }

  /**
   * Specifications alone — §2.3, "for partial refreshes". A slug that names no product is a
   * 404 here exactly as it is on the detail endpoint; an empty array means a product that
   * genuinely has no specifications.
   */
  async findSpecificationsBySlug(
    slug: string,
    locale: ResolvedLocale,
  ): Promise<ProductSpecificationResponse[]> {
    const productId = await this.findIdBySlug(slug, locale);

    if (productId === null) {
      throw new ApiException(HttpStatus.NOT_FOUND, ErrorCode.NotFound, NOT_FOUND_MESSAGE);
    }

    const rows = await this.prisma.specification.findMany({
      // The same public predicate as the detail select. Stated here too rather than assumed:
      // this is a SECOND route to the same rows, and a partial-refresh endpoint that returned
      // what the full response withholds would be the leak the filter exists to prevent.
      where: { productId, ...PUBLIC_SPECIFICATION_WHERE },
      orderBy: [{ key: "asc" }, { value: "asc" }],
      select: PUBLIC_SPECIFICATION_SELECT,
    });

    return rows.map(toSpecificationResponse);
  }

  /**
   * Whether a `Product` row with this id exists — the cross-module read the Forms module makes
   * before writing an `Inquiry.relatedProductId`.
   *
   * Exists here rather than in the caller because `Product` is this module's entity:
   * ARCHITECTURE.md's modular-monolith rule routes cross-module access through the owning module's
   * service interface, never through its Prisma model. This is the interface.
   *
   * Deliberately narrow. It takes an **id**, not a slug, and answers a boolean, not a record: the
   * caller is validating a foreign key, not reading a product, and a method that returned the row
   * would invite a consumer to render it without any locale having been resolved. `select: { id }`
   * so the existence check reads one indexed column.
   */
  async existsById(id: string): Promise<boolean> {
    const product = await this.prisma.product.findUnique({ where: { id }, select: { id: true } });

    return product !== null;
  }

  /**
   * The at-most-one primary Product Type, through the same overlay as everything else.
   *
   * `localize` takes and returns arrays, so the wrapping and unwrapping happens here rather
   * than at the call site. A null type — the state of every product while no ProductType row
   * is approved — queries nothing and has nothing it could fall back from.
   */
  private async localizeProductType(
    productType: TaxonomyRow | null,
    locale: ResolvedLocale,
  ): Promise<LocalizedTaxonomyRow> {
    if (productType === null) {
      return { row: null, localeFallback: false };
    }

    const { rows, localeFallback } = await this.translations.localize(
      ContentEntityType.ProductType,
      [productType],
      PRODUCT_TYPE_TRANSLATED_FIELDS,
      locale,
    );

    // `?? productType` is the untranslated row, not a placeholder: localize returns its input
    // one-for-one, so this only satisfies noUncheckedIndexedAccess.
    return { row: rows[0] ?? productType, localeFallback };
  }

  private async buildWhere(
    query: ProductListQuery,
    locale: ResolvedLocale,
  ): Promise<Prisma.ProductWhereInput> {
    const where: Prisma.ProductWhereInput = {};
    const categorySlug = normalizeFilter(query.category);
    const segmentSlug = normalizeFilter(query.segment);
    const productTypeSlug = normalizeFilter(query.productType);
    const search = normalizeFilter(query.q);

    if (categorySlug !== undefined) {
      where.categoryId = await this.resolveCategoryId(categorySlug, locale);
    }

    // Sibling keys on one `where` object, which Prisma ANDs — ADR-008's conjunctive semantics
    // for every combination of the three axes. Family, Segment and Product Type narrow
    // together rather than competing, because they classify a product along axes that are
    // orthogonal by decision (ADR-007 §4).
    if (segmentSlug !== undefined) {
      where.segments = { some: { segmentId: await this.resolveSegmentId(segmentSlug, locale) } };
    }

    // Single-valued on the product, so this is equality on the column rather than a relation
    // predicate — `Product ↔ ProductType` many-to-many stays deferred in ADR-007.
    if (productTypeSlug !== undefined) {
      where.productTypeId = await this.resolveProductTypeId(productTypeSlug, locale);
    }

    // `OR` is assigned last and stays a sibling of the taxonomy keys, not a wrapper around
    // them: Prisma ANDs the top-level keys, so the search's internal OR branches keep their own
    // meaning while the whole search term narrows the taxonomy-filtered set.
    if (search !== undefined) {
      where.OR = await this.buildSearchFilter(search, locale);
    }

    return where;
  }

  /**
   * The approved editorial copy for these products, in this locale (ADR-019 §5).
   *
   * ── Why this reads a view and not the table ────────────────────────────
   *
   * `v_product_copy_public` is the sanctioned public read model, and it carries the three rules
   * that decide publication: approved, live, and written for an ACTIVE locale. Selecting from
   * `product_copy` here would restate two of them and quietly drop the third, which is exactly the
   * drift ADR-014 §8 put the definition in the database to prevent.
   *
   * ── Requested locale, then default, then nothing ───────────────────────
   *
   * The same precedence `ContentTranslationService` applies to every other translated field, and
   * for the same reason: a visitor reading Persian should see Persian copy where a reviewer has
   * approved some, and English where none exists yet — rather than an empty description that reads
   * as a product nobody has described.
   *
   * "Then nothing" is the important arm and it is the state of all 100 products today: a product
   * with no approved copy in either locale is absent from this map, and its description is left
   * exactly as it was. Approval is what publishes copy; this method never invents any.
   */
  private async approvedCopy(
    productIds: readonly string[],
    locale: ResolvedLocale,
  ): Promise<ReadonlyMap<string, string>> {
    if (productIds.length === 0) return new Map();

    const rows = await this.prisma.$queryRawUnsafe<
      { productId: string; locale: string; summary: string }[]
    >(
      `SELECT "product_id" AS "productId", "locale", "summary"
         FROM "v_product_copy_public"
        WHERE "product_id" = ANY($1::uuid[])
          AND "locale" IN ($2, $3)`,
      [...productIds],
      locale.code,
      locale.defaultCode,
    );

    const requested = new Map<string, string>();
    const fallback = new Map<string, string>();

    for (const row of rows) {
      // Two rows per product at most, and the requested locale wins whichever order they arrive in.
      if (row.locale === locale.code) requested.set(row.productId, row.summary);
      else fallback.set(row.productId, row.summary);
    }

    for (const [productId, summary] of fallback) {
      if (!requested.has(productId)) requested.set(productId, summary);
    }

    return requested;
  }

  /**
   * `?category=` is a category slug, locale-aware and matched EXACTLY — a parent category does
   * not pull in its children's products. Subtree filtering is a separate decision: with a
   * self-referencing hierarchy it needs a recursive CTE or a materialized path, and neither is
   * in this step's scope.
   *
   * An unresolvable slug is a 400, not an empty 200. A typo'd category that renders as "no
   * products in this category" is indistinguishable from a real empty category, which is
   * exactly the silent failure that survives to production.
   */
  private async resolveCategoryId(slug: string, locale: ResolvedLocale): Promise<string> {
    const translatedId = locale.isDefault
      ? null
      : await this.translations.findEntityIdBySlug(ContentEntityType.Category, slug, locale);

    if (translatedId !== null) {
      return translatedId;
    }

    const category = await this.prisma.category.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (category === null) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.ValidationError,
        UNKNOWN_CATEGORY_MESSAGE,
        [{ field: "category", issue: UNKNOWN_CATEGORY_ISSUE }],
      );
    }

    return category.id;
  }

  /**
   * `?segment=` is a Segment slug, resolved exactly as `?category=` is: translated slug first
   * for a non-default locale, base column second, 400 if neither matches.
   *
   * Written out rather than folded together with the other two resolvers. The three differ in
   * their Prisma delegate, their ContentEntityType and their error text, which is most of what
   * each one is — a shared helper would take all three as parameters and leave nothing behind
   * but the control flow, at the cost of hiding a pattern the category filter already sets.
   */
  private async resolveSegmentId(slug: string, locale: ResolvedLocale): Promise<string> {
    const translatedId = locale.isDefault
      ? null
      : await this.translations.findEntityIdBySlug(ContentEntityType.Segment, slug, locale);

    if (translatedId !== null) {
      return translatedId;
    }

    const segment = await this.prisma.segment.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (segment === null) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.ValidationError,
        UNKNOWN_SEGMENT_MESSAGE,
        [{ field: "segment", issue: UNKNOWN_SEGMENT_ISSUE }],
      );
    }

    return segment.id;
  }

  /**
   * `?productType=` is a Product Type slug, resolved on the same rules as the other two axes.
   *
   * Every non-blank value answers 400 until a Product Type vocabulary is approved and its rows
   * are populated — no ProductType name or slug is approved yet (ADR-008). That is the contract
   * working, not a defect: an unknown slug is a 400 whether the table is empty or the caller
   * simply mistyped, and the two are indistinguishable from outside.
   */
  private async resolveProductTypeId(slug: string, locale: ResolvedLocale): Promise<string> {
    const translatedId = locale.isDefault
      ? null
      : await this.translations.findEntityIdBySlug(ContentEntityType.ProductType, slug, locale);

    if (translatedId !== null) {
      return translatedId;
    }

    const productType = await this.prisma.productType.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (productType === null) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.ValidationError,
        UNKNOWN_PRODUCT_TYPE_MESSAGE,
        [{ field: "productType", issue: UNKNOWN_PRODUCT_TYPE_ISSUE }],
      );
    }

    return productType.id;
  }

  /**
   * §2.7: "q matches product name, slug, and specification values — specification matching
   * matters most, because real buyer queries are grade strings (SN 500, ISO VG 46, 15W-40)
   * that live in Specification.value, not in prose."
   *
   * The fourth branch is the localized half: for a non-default locale the visible name and
   * slug are `content_translations` rows, so without it a Persian search term could only ever
   * match the English base row. Resolving matching ids first and passing them as `id IN (...)`
   * keeps this one extra query rather than a correlated subquery per product.
   */
  private async buildSearchFilter(
    search: string,
    locale: ResolvedLocale,
  ): Promise<Prisma.ProductWhereInput[]> {
    const branches: Prisma.ProductWhereInput[] = [
      { name: { contains: search, mode: "insensitive" } },
      { slug: { contains: search, mode: "insensitive" } },
      // Approved and live only, for the same reason the detail select filters: a `?q=` that
      // matched an unapproved value would answer "does the platform hold a specification
      // saying 173?" for data nobody published. A search that can confirm a value is a way of
      // reading it, and the contract's "q matches specification values" means the values the
      // caller is allowed to see.
      {
        specifications: {
          some: { ...PUBLIC_SPECIFICATION_WHERE, value: { contains: search, mode: "insensitive" } },
        },
      },
    ];

    if (locale.isDefault) {
      return branches;
    }

    const translatedMatches = await this.translations.findEntityIdsByTranslatedValue(
      ContentEntityType.Product,
      PRODUCT_SEARCHABLE_FIELDS,
      search,
      locale,
    );

    // An empty `id IN ()` branch would be dead weight in every query that finds no translated
    // match, which is most of them.
    if (translatedMatches.length > 0) {
      branches.push({ id: { in: translatedMatches } });
    }

    return branches;
  }

  private async findDetailBySlug(
    slug: string,
    locale: ResolvedLocale,
  ): Promise<Prisma.ProductGetPayload<{ select: typeof PRODUCT_DETAIL_SELECT }> | null> {
    const where = await this.resolveSlugToWhere(slug, locale);

    return this.prisma.product.findUnique({ where, select: PRODUCT_DETAIL_SELECT });
  }

  private async findIdBySlug(slug: string, locale: ResolvedLocale): Promise<string | null> {
    const where = await this.resolveSlugToWhere(slug, locale);
    const product = await this.prisma.product.findUnique({ where, select: { id: true } });

    return product?.id ?? null;
  }

  /**
   * Turns a locale-specific slug into the unique-where the product tables are read by.
   *
   * A translated slug wins over the base column: if a `fa` slug and some other product's `en`
   * slug ever collide, the more specific match is the right one. When the translation row
   * points at a product that no longer exists the result is a 404 rather than a second attempt
   * at the base slug — `content_translations` is polymorphic and carries no foreign key to
   * `products`, so a stale row is possible, and quietly serving a different product would be
   * worse than reporting the miss.
   */
  private async resolveSlugToWhere(
    slug: string,
    locale: ResolvedLocale,
  ): Promise<Prisma.ProductWhereUniqueInput> {
    if (locale.isDefault) {
      return { slug };
    }

    const translatedId = await this.translations.findEntityIdBySlug(
      ContentEntityType.Product,
      slug,
      locale,
    );

    return translatedId === null ? { slug } : { id: translatedId };
  }
}

/**
 * Strips the internal id — `name` and `slug` are the whole of a taxonomy reference on the wire.
 *
 * One function for both axes because ProductSegmentResponse and ProductTypeResponse are the
 * same two fields; the return type is written structurally rather than as one of them, since
 * neither is more the caller than the other.
 */
function toTaxonomyRef(row: TaxonomyRow): { name: string; slug: string } {
  return { name: row.name, slug: row.slug };
}

function toListItem(row: ProductRow): ProductListItemResponse {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    categoryId: row.categoryId,
    createdAt: row.createdAt.toISOString(),
  };
}

export type { LocalizedProduct, LocalizedProductList };
