import { HttpStatus, Injectable } from "@nestjs/common";

import { ContentEntityType } from "../../common/content/content-entity-type";
import { ContentTranslationService } from "../../common/content/content-translation.service";
import { ApiException } from "../../common/http/api.exception";
import { ErrorCode } from "../../common/http/error-code";
import { PrismaService } from "../../prisma/prisma.service";

import { DEFAULT_LIMIT, DEFAULT_PAGE, DEFAULT_SORT } from "./dto/blog-post-list.query";

import type { BlogPostListQuery, BlogPostSort } from "./dto/blog-post-list.query";
import type { BlogPostDetailResponse, BlogPostListItemResponse } from "./dto/blog-post.response";
import type { ResolvedLocale } from "../../common/locale/resolved-locale";
import type { Prisma } from "../../prisma/generated/client";

const NOT_FOUND_MESSAGE = "Post not found.";
const UNKNOWN_CATEGORY_MESSAGE = "The requested category filter does not match a blog category.";
const UNKNOWN_CATEGORY_ISSUE = "must be the slug of an existing blog category";

/**
 * The `content_translations.field` values this module translates for a post. All three are columns
 * on `blog_posts`, which is what makes them translatable: the base row holds the default locale and
 * every other locale is a row in `content_translations`.
 *
 * `BlogPost` is one of the entity types ContentEntityType covers (DATA_MODEL.md §Notes names
 * `Product`, `Category` and `BlogPost` as the Prisma-owned localized content).
 */
const BLOG_POST_TRANSLATED_FIELDS = ["title", "slug", "content"] as const;

/**
 * The subset the LIST overlays, which is the subset the list actually selects. Asking for a
 * translation of `content` on a row that does not carry `content` would fetch rows nothing can
 * apply, and — because a missing translation for a non-null base value raises the flag — would
 * report `localeFallback` for a field the response does not contain.
 */
const BLOG_POST_LIST_TRANSLATED_FIELDS = ["title", "slug"] as const;

/**
 * There is deliberately NO equivalent list for `BlogCategory` or `BlogTag`, and their `name`/`slug`
 * are served verbatim in every locale.
 *
 * Neither is a `ContentEntityType` member. Adding one would introduce new `entityType` vocabulary
 * into four polymorphic tables — `content_translations`, `seo_meta`, `status_history`,
 * `media.owner_type` — none of which any approved document lists it in, and
 * ARCHITECTURE.md §Internationalization enumerates the localized Prisma-owned set as Product,
 * Category, BlogPost, Segment and ProductType. That is a vocabulary decision, not an implementation
 * detail, so this module reads the base columns and says so rather than deciding it.
 *
 * The observable consequence today is nil: `content_translations` holds no rows at all. The
 * consequence that matters is that a Persian blog index shows an English category label, which is
 * exactly the condition `meta.localeFallback` exists to declare — and it is declared, because the
 * post's own overlay raises the flag for the same request.
 */

const BLOG_POST_SELECT = {
  id: true,
  title: true,
  slug: true,
  publishedAt: true,
  category: { select: { name: true, slug: true } },
} as const satisfies Prisma.BlogPostSelect;

const BLOG_POST_DETAIL_SELECT = {
  id: true,
  title: true,
  slug: true,
  content: true,
  publishedAt: true,
  category: { select: { name: true, slug: true } },
  tags: {
    // `blog_post_tags` has no ordering column, and `blog_tags` has no `sortOrder` — ordering by
    // name and then by the tag's id is what makes two requests for the same post emit the same
    // array rather than leaving it to insertion order.
    orderBy: [{ blogTag: { name: "asc" } }, { blogTagId: "asc" }],
    select: { blogTag: { select: { name: true, slug: true } } },
  },
} as const satisfies Prisma.BlogPostSelect;

/**
 * Every sort carries `id` as a tiebreaker. Without it two posts sharing a `publishedAt` — which a
 * bulk import or a scheduled batch makes likely — can order differently between two queries, and a
 * row then appears on both page 1 and page 2 or on neither.
 */
const BLOG_POST_ORDER_BY: Record<BlogPostSort, Prisma.BlogPostOrderByWithRelationInput[]> = {
  publishedAt: [{ publishedAt: "asc" }, { id: "asc" }],
  "-publishedAt": [{ publishedAt: "desc" }, { id: "asc" }],
};

/** A post row as selected for the list, before localization — default-locale values. */
type BlogPostRow = {
  id: string;
  title: string;
  slug: string;
  publishedAt: Date | null;
  category: { name: string; slug: string };
};

type LocalizedBlogPostList = {
  posts: BlogPostListItemResponse[];
  total: number;
  /** The page actually served, after defaults — the controller echoes it into `meta`. */
  page: number;
  limit: number;
  localeFallback: boolean;
};

type LocalizedBlogPost = {
  post: BlogPostDetailResponse;
  localeFallback: boolean;
};

/**
 * A filter control submits itself even when the user left it blank, so `?category=` is an
 * unfiltered list rather than a malformed request. Trimming here — not in the DTO — keeps the
 * validation layer describing shape and this layer describing meaning.
 */
function normalizeFilter(value: string | undefined): string | undefined {
  const trimmed = value?.trim();

  return trimmed === undefined || trimmed === "" ? undefined : trimmed;
}

@Injectable()
export class BlogPostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly translations: ContentTranslationService,
  ) {}

  /**
   * The Insights index's backend.
   *
   * Sorting is by `publishedAt`, which is not translated, so the order is the same in every locale
   * — unlike the catalog, where sorting by a translated `name` forced a documented trade-off. The
   * `id` tiebreaker is what makes it total.
   */
  async findAll(locale: ResolvedLocale, query: BlogPostListQuery): Promise<LocalizedBlogPostList> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const sort = query.sort ?? DEFAULT_SORT;
    const where = await this.buildWhere(query);

    // Both statements read the same snapshot-per-statement, so a concurrent publish can leave
    // `total` one ahead of the rows — acceptable for an article index, and the alternative (an
    // interactive transaction) holds a connection open on a public endpoint.
    const [total, rows] = await Promise.all([
      this.prisma.blogPost.count({ where }),
      this.prisma.blogPost.findMany({
        where,
        orderBy: BLOG_POST_ORDER_BY[sort],
        skip: (page - 1) * limit,
        take: limit,
        select: BLOG_POST_SELECT,
      }),
    ]);

    const { rows: localized, localeFallback } = await this.translations.localize(
      ContentEntityType.BlogPost,
      rows,
      BLOG_POST_LIST_TRANSLATED_FIELDS,
      locale,
    );

    return {
      posts: localized.map((row) => toListItem(row)),
      total,
      page,
      limit,
      localeFallback,
    };
  }

  /**
   * One published post with its category and tags.
   *
   * `:slug` is the locale-specific slug: the translated slug is tried first and the row's own slug
   * second, so a post with no translated slug is still reachable in that locale at its
   * default-locale path (API_CONTRACT_FINAL.md §3's fallback rule).
   *
   * An unpublished post is a 404 and not a 403: whether a draft exists is not a fact a public
   * endpoint should leak, and from outside there is no difference between a post that was never
   * written and one that has not been published.
   */
  async findBySlug(slug: string, locale: ResolvedLocale): Promise<LocalizedBlogPost> {
    const identity = await this.resolveSlugToWhere(slug, locale);

    // `findFirst` rather than `findUnique`: the published predicate is not part of any unique key,
    // and `findUnique` accepts only unique fields in its `where`. `blog_posts.slug` and `id` are
    // both unique, so this is still a single-row lookup.
    const row = await this.prisma.blogPost.findFirst({
      where: { ...identity, ...publishedWhere() },
      select: BLOG_POST_DETAIL_SELECT,
    });

    if (row === null) {
      // The slug is caller-supplied text and §8 contracts `message` as safe to display, so it is
      // not echoed back.
      throw new ApiException(HttpStatus.NOT_FOUND, ErrorCode.NotFound, NOT_FOUND_MESSAGE);
    }

    // `category` and `tags` are pulled out of the rest spread deliberately: what follows hands
    // `post` to localize as a BlogPost row, and a nested relation riding along in it would be a
    // shape the translation overlay never asked for.
    const { category, tags, ...post } = row;

    const { rows, localeFallback } = await this.translations.localize(
      ContentEntityType.BlogPost,
      [post],
      BLOG_POST_TRANSLATED_FIELDS,
      locale,
    );

    // `?? post` is the untranslated row, not a placeholder: localize returns its input one-for-one,
    // so this only satisfies noUncheckedIndexedAccess.
    const translated = rows[0] ?? post;

    return {
      post: {
        id: translated.id,
        title: translated.title,
        slug: translated.slug,
        content: translated.content,
        publishedAt: requirePublishedAt(translated.publishedAt),
        category,
        tags: tags.map((membership) => membership.blogTag),
      },
      localeFallback,
    };
  }

  private async buildWhere(query: BlogPostListQuery): Promise<Prisma.BlogPostWhereInput> {
    const where: Prisma.BlogPostWhereInput = publishedWhere();
    const categorySlug = normalizeFilter(query.category);

    if (categorySlug !== undefined) {
      where.categoryId = await this.resolveCategoryId(categorySlug);
    }

    return where;
  }

  /**
   * `?category=` is a `BlogCategory` slug, matched EXACTLY. `BlogCategory` has no hierarchy, so
   * there is no subtree question to answer here.
   *
   * **Not locale-aware**, unlike `GET /products?category=`. `BlogCategory` carries no translation
   * rows — see the note above BLOG_POST_TRANSLATED_FIELDS — so there is no localized slug that
   * could resolve, and pretending to look one up would imply a localization that does not exist.
   *
   * An unresolvable slug is a 400, not an empty 200. A typo'd category that renders as "no posts in
   * this category" is indistinguishable from a real empty category, which is exactly the silent
   * failure that survives to production.
   */
  private async resolveCategoryId(slug: string): Promise<string> {
    const category = await this.prisma.blogCategory.findUnique({
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
   * Turns a locale-specific slug into the identity half of the detail read.
   *
   * A translated slug wins over the base column: if a `fa` slug and some other post's `en` slug ever
   * collide, the more specific match is the right one. When the translation row points at a post
   * that no longer exists the result is a 404 rather than a second attempt at the base slug —
   * `content_translations` is polymorphic and carries no foreign key to `blog_posts`, so a stale row
   * is possible, and quietly serving a different article would be worse than reporting the miss.
   *
   * This mirrors `ProductsService.resolveSlugToWhere` and is written out rather than shared with it:
   * the two name different Prisma delegates and different ContentEntityType members, and a shared
   * helper taking both as parameters would leave nothing behind but the control flow.
   */
  private async resolveSlugToWhere(
    slug: string,
    locale: ResolvedLocale,
  ): Promise<{ slug: string } | { id: string }> {
    if (locale.isDefault) {
      return { slug };
    }

    const translatedId = await this.translations.findEntityIdBySlug(
      ContentEntityType.BlogPost,
      slug,
      locale,
    );

    return translatedId === null ? { slug } : { id: translatedId };
  }
}

/**
 * The published predicate, in one place because both endpoints must agree on it exactly.
 *
 * "Published" is `publishedAt` set AND in the past — the definition API_CONTRACT_FINAL.md §6 already
 * fixes for the RAG export ("`BlogPost.publishedAt` set and in the past"). `sam_platform` has no
 * draft/published status column for blog content, so this timestamp is the whole of the mechanism,
 * and a future-dated post is a scheduled one rather than a live one.
 *
 * A function rather than a constant: `new Date()` evaluated once at module load would freeze the
 * cutoff at process start, and a post scheduled for this afternoon would stay invisible until the
 * API was restarted.
 */
function publishedWhere(): Prisma.BlogPostWhereInput {
  return { publishedAt: { not: null, lte: new Date() } };
}

/**
 * `publishedAt` as a non-null ISO string.
 *
 * Every read in this module carries the published predicate, so a null cannot reach here. The throw
 * satisfies the type and states what would have to have gone wrong — serving a post whose
 * `publishedAt` is null would be publishing a draft, so failing loudly is the correct response to a
 * state that should be unreachable.
 */
function requirePublishedAt(publishedAt: Date | null): string {
  if (publishedAt === null) {
    throw new ApiException(
      HttpStatus.INTERNAL_SERVER_ERROR,
      ErrorCode.InternalError,
      "A post was read without a publication date.",
    );
  }

  return publishedAt.toISOString();
}

function toListItem(row: BlogPostRow): BlogPostListItemResponse {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    publishedAt: requirePublishedAt(row.publishedAt),
    category: row.category,
  };
}

export type { LocalizedBlogPost, LocalizedBlogPostList };
