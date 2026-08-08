import { HttpStatus, Injectable } from "@nestjs/common";

import { ContentEntityType } from "../../common/content/content-entity-type";
import { ContentTranslationService } from "../../common/content/content-translation.service";
import { ApiException } from "../../common/http/api.exception";
import { ErrorCode } from "../../common/http/error-code";
import { MediaType } from "../../prisma/generated/client";
import { PrismaService } from "../../prisma/prisma.service";
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

const PRODUCT_SELECT = {
  id: true,
  name: true,
  slug: true,
  description: true,
  categoryId: true,
  createdAt: true,
} as const;

const PRODUCT_DETAIL_SELECT = {
  id: true,
  name: true,
  slug: true,
  description: true,
  createdAt: true,
  category: { select: CATEGORY_SELECT },
  specifications: {
    // `specifications` has no ordering column and no unique on (product_id, key) — a product
    // may legitimately repeat a key, one row per grade. Ordering by key then value is what
    // makes the response stable across requests rather than left to insertion order.
    orderBy: [{ key: "asc" }, { value: "asc" }],
    select: { id: true, key: true, value: true, unit: true },
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

    return {
      products: localized.map((row) => toListItem(row)),
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

    const { category, specifications, ...product } = row;

    const [localizedProduct, localizedCategory, images] = await Promise.all([
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
      this.findImages(product.id),
    ]);

    // `?? product` / `?? category` are the untranslated rows, not placeholders: localize
    // returns its input one-for-one, so these only satisfy noUncheckedIndexedAccess.
    const translated = localizedProduct.rows[0] ?? product;

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
        fallbackDescription: translated.description,
      },
      locale,
    );

    return {
      product: {
        id: translated.id,
        name: translated.name,
        slug: translated.slug,
        description: translated.description,
        createdAt: translated.createdAt.toISOString(),
        category: localizedCategory.rows[0] ?? category,
        specifications,
        images,
        seo,
      },
      localeFallback: localizedProduct.localeFallback || localizedCategory.localeFallback,
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

    return this.prisma.specification.findMany({
      where: { productId },
      orderBy: [{ key: "asc" }, { value: "asc" }],
      select: { id: true, key: true, value: true, unit: true },
    });
  }

  private async buildWhere(
    query: ProductListQuery,
    locale: ResolvedLocale,
  ): Promise<Prisma.ProductWhereInput> {
    const where: Prisma.ProductWhereInput = {};
    const categorySlug = normalizeFilter(query.category);
    const search = normalizeFilter(query.q);

    if (categorySlug !== undefined) {
      where.categoryId = await this.resolveCategoryId(categorySlug, locale);
    }

    if (search !== undefined) {
      where.OR = await this.buildSearchFilter(search, locale);
    }

    return where;
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
      { specifications: { some: { value: { contains: search, mode: "insensitive" } } } },
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

  /**
   * Public imagery only. `media` has no visibility column, so the boundary is drawn on `type`:
   * `image` rows are the product gallery, while COA, SDS, TDS and every other document are
   * `file`/`document` rows and never enter this result. Nothing here can be widened by adding
   * a media row — a new document type is excluded by default.
   *
   * Ordered by id because `media` carries no sort or timestamp column; the value is arbitrary
   * but the ORDER is stable, which is what a gallery needs.
   */
  private findImages(
    productId: string,
  ): Promise<{ id: string; url: string; altText: string | null }[]> {
    return this.prisma.media.findMany({
      // Matches @@index([ownerType, ownerId]).
      where: { ownerType: ContentEntityType.Product, ownerId: productId, type: MediaType.IMAGE },
      orderBy: { id: "asc" },
      select: { id: true, url: true, altText: true },
    });
  }
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
