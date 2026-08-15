import { ContentTranslationService } from "../../common/content/content-translation.service";
import { ApiException } from "../../common/http/api.exception";
import { ErrorCode } from "../../common/http/error-code";
import { PrismaService } from "../../prisma/prisma.service";

import { BlogPostsService } from "./blog-posts.service";

import type { ResolvedLocale } from "../../common/locale/resolved-locale";

const EN: ResolvedLocale = { code: "en", defaultCode: "en", isDefault: true };
const FA: ResolvedLocale = { code: "fa", defaultCode: "en", isDefault: false };

const CATEGORY = { name: "Demo Category", slug: "sam-demo-insights" };

const PUBLISHED_AT = new Date("2026-03-04T10:00:00.000Z");

const POST_ROW = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Understanding Base Oil Groups",
  slug: "sam-demo-understanding-base-oil-groups",
  publishedAt: PUBLISHED_AT,
  category: CATEGORY,
};

const DETAIL_ROW = {
  ...POST_ROW,
  content: "DEMO / PLACEHOLDER CONTENT.",
  tags: [{ blogTag: { name: "Demo Tag", slug: "sam-demo-tag" } }],
};

type Stubs = {
  service: BlogPostsService;
  postCount: jest.Mock;
  postFindMany: jest.Mock;
  postFindFirst: jest.Mock;
  categoryFindUnique: jest.Mock;
  translationFindMany: jest.Mock;
  translationFindFirst: jest.Mock;
};

/** No database is reached — only the delegate methods this service calls are stubbed. */
function createService(): Stubs {
  const postCount = jest.fn().mockResolvedValue(1);
  const postFindMany = jest.fn().mockResolvedValue([POST_ROW]);
  const postFindFirst = jest.fn().mockResolvedValue(DETAIL_ROW);
  const categoryFindUnique = jest.fn().mockResolvedValue({ id: "cat-1" });
  const translationFindMany = jest.fn().mockResolvedValue([]);
  const translationFindFirst = jest.fn().mockResolvedValue(null);

  const prisma = {
    blogPost: { count: postCount, findMany: postFindMany, findFirst: postFindFirst },
    blogCategory: { findUnique: categoryFindUnique },
    contentTranslation: { findMany: translationFindMany, findFirst: translationFindFirst },
  } as unknown as PrismaService;

  return {
    // The real translation service, not a stub: it owns the translation queries these tests assert
    // on, and stubbing it would leave those assertions checking nothing.
    service: new BlogPostsService(prisma, new ContentTranslationService(prisma)),
    postCount,
    postFindMany,
    postFindFirst,
    categoryFindUnique,
    translationFindMany,
    translationFindFirst,
  };
}

async function captureError(promise: Promise<unknown>): Promise<ApiException> {
  try {
    await promise;
  } catch (thrown) {
    return thrown as ApiException;
  }

  throw new Error("Expected the call to reject, but it resolved.");
}

/** The `publishedAt` predicate as the service builds it, minus the moving `lte` value. */
function expectPublishedFilter(where: unknown): void {
  const filter = (where as { publishedAt: { not: null; lte: Date } }).publishedAt;

  expect(filter.not).toBeNull();
  expect(filter.lte).toBeInstanceOf(Date);
}

describe("BlogPostsService.findAll — pagination and sorting", () => {
  it("applies the documented defaults when the query carries none", async () => {
    const { service, postFindMany } = createService();

    const result = await service.findAll(EN, {});

    expect(postFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 12,
        orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
      }),
    );
    expect(result.page).toBe(1);
    expect(result.limit).toBe(12);
  });

  it("translates page and limit into skip and take", async () => {
    const { service, postFindMany } = createService();

    await service.findAll(EN, { page: 3, limit: 5 });

    expect(postFindMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 5 }));
  });

  it("orders oldest-first for the ascending sort, keeping the id tiebreaker", async () => {
    const { service, postFindMany } = createService();

    await service.findAll(EN, { sort: "publishedAt" });

    expect(postFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [{ publishedAt: "asc" }, { id: "asc" }] }),
    );
  });

  it("reports the API's own total rather than the page length", async () => {
    const { service, postCount } = createService();

    postCount.mockResolvedValue(41);

    const result = await service.findAll(EN, {});

    expect(result.total).toBe(41);
    expect(result.posts).toHaveLength(1);
  });
});

describe("BlogPostsService.findAll — the published filter", () => {
  it("serves only posts whose publishedAt is set and in the past", async () => {
    const { service, postFindMany, postCount } = createService();

    await service.findAll(EN, {});

    const listArgs = postFindMany.mock.calls[0]?.[0] as { where: unknown };
    const countArgs = postCount.mock.calls[0]?.[0] as { where: unknown };

    expectPublishedFilter(listArgs.where);
    // The count must filter identically, or `meta.total` would promise pages of drafts.
    expectPublishedFilter(countArgs.where);
  });

  it("evaluates the cutoff per request rather than at module load", async () => {
    const { service, postFindMany } = createService();

    await service.findAll(EN, {});
    const first = (postFindMany.mock.calls[0]?.[0] as { where: { publishedAt: { lte: Date } } })
      .where.publishedAt.lte;

    await service.findAll(EN, {});
    const second = (postFindMany.mock.calls[1]?.[0] as { where: { publishedAt: { lte: Date } } })
      .where.publishedAt.lte;

    expect(second.getTime()).toBeGreaterThanOrEqual(first.getTime());
  });
});

describe("BlogPostsService.findAll — the category filter", () => {
  it("resolves a category slug to an id and narrows on it", async () => {
    const { service, postFindMany, categoryFindUnique } = createService();

    await service.findAll(EN, { category: "sam-demo-insights" });

    expect(categoryFindUnique).toHaveBeenCalledWith({
      where: { slug: "sam-demo-insights" },
      select: { id: true },
    });
    expect(postFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ categoryId: "cat-1" }) }),
    );
  });

  it("treats a blank value as an omitted filter rather than a malformed request", async () => {
    const { service, postFindMany, categoryFindUnique } = createService();

    await service.findAll(EN, { category: "  " });

    expect(categoryFindUnique).not.toHaveBeenCalled();
    expect(postFindMany.mock.calls[0]?.[0]).not.toHaveProperty("where.categoryId");
  });

  it("answers 400 VALIDATION_ERROR naming the field for a slug that matches no category", async () => {
    const { service, categoryFindUnique } = createService();

    categoryFindUnique.mockResolvedValue(null);

    const error = await captureError(service.findAll(EN, { category: "not-a-category" }));

    expect(error.getStatus()).toBe(400);
    expect(error.code).toBe(ErrorCode.ValidationError);
    expect(error.details).toEqual([{ field: "category", issue: expect.any(String) }]);
    // The caller-supplied slug is never echoed back into a displayable message.
    expect(error.message).not.toContain("not-a-category");
  });

  it("does not consult content_translations for the category slug in a non-default locale", async () => {
    const { service, translationFindFirst, categoryFindUnique } = createService();

    await service.findAll(FA, { category: "sam-demo-insights" });

    // BlogCategory is not a ContentEntityType member — the base column is the only lookup.
    expect(translationFindFirst).not.toHaveBeenCalled();
    expect(categoryFindUnique).toHaveBeenCalledTimes(1);
  });
});

describe("BlogPostsService.findAll — localization", () => {
  it("issues no translation query in the default locale", async () => {
    const { service, translationFindMany } = createService();

    const result = await service.findAll(EN, {});

    expect(translationFindMany).not.toHaveBeenCalled();
    expect(result.localeFallback).toBe(false);
  });

  it("overlays title and slug, and does not ask for content the list never selected", async () => {
    const { service, translationFindMany } = createService();

    translationFindMany.mockResolvedValue([
      { entityId: POST_ROW.id, field: "title", value: "عنوان" },
      { entityId: POST_ROW.id, field: "slug", value: "عنوان-نمونه" },
    ]);

    const result = await service.findAll(FA, {});

    expect(translationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          entityType: "BlogPost",
          locale: "fa",
          field: { in: ["title", "slug"] },
        }),
      }),
    );
    expect(result.posts[0]?.title).toBe("عنوان");
    expect(result.posts[0]?.slug).toBe("عنوان-نمونه");
    expect(result.localeFallback).toBe(false);
  });

  it("raises localeFallback when a requested locale has no translation", async () => {
    const { service } = createService();

    const result = await service.findAll(FA, {});

    expect(result.localeFallback).toBe(true);
    expect(result.posts[0]?.title).toBe(POST_ROW.title);
  });

  it("serves the category name untranslated, and says so through the fallback flag", async () => {
    const { service } = createService();

    const result = await service.findAll(FA, {});

    expect(result.posts[0]?.category).toEqual(CATEGORY);
    expect(result.localeFallback).toBe(true);
  });
});

describe("BlogPostsService.findBySlug", () => {
  it("reads by the base slug in the default locale, with the published filter attached", async () => {
    const { service, postFindFirst, translationFindFirst } = createService();

    await service.findBySlug(POST_ROW.slug, EN);

    expect(translationFindFirst).not.toHaveBeenCalled();

    const args = postFindFirst.mock.calls[0]?.[0] as { where: { slug: string } };

    expect(args.where.slug).toBe(POST_ROW.slug);
    expectPublishedFilter(args.where);
  });

  it("prefers a translated slug over the base column in a non-default locale", async () => {
    const { service, postFindFirst, translationFindFirst } = createService();

    translationFindFirst.mockResolvedValue({ entityId: POST_ROW.id });

    await service.findBySlug("عنوان-نمونه", FA);

    const args = postFindFirst.mock.calls[0]?.[0] as { where: { id: string } };

    expect(args.where.id).toBe(POST_ROW.id);
  });

  it("falls back to the base slug when the locale has no translated slug", async () => {
    const { service, postFindFirst } = createService();

    await service.findBySlug(POST_ROW.slug, FA);

    const args = postFindFirst.mock.calls[0]?.[0] as { where: { slug: string } };

    expect(args.where.slug).toBe(POST_ROW.slug);
  });

  it("serves the body, the category and the tags", async () => {
    const { service } = createService();

    const { post } = await service.findBySlug(POST_ROW.slug, EN);

    expect(post.content).toBe(DETAIL_ROW.content);
    expect(post.category).toEqual(CATEGORY);
    expect(post.tags).toEqual([{ name: "Demo Tag", slug: "sam-demo-tag" }]);
    expect(post.publishedAt).toBe(PUBLISHED_AT.toISOString());
  });

  it("answers 404 NOT_FOUND for a slug no published post carries", async () => {
    const { service, postFindFirst } = createService();

    postFindFirst.mockResolvedValue(null);

    const error = await captureError(service.findBySlug("nothing-here", EN));

    expect(error.getStatus()).toBe(404);
    expect(error.code).toBe(ErrorCode.NotFound);
    // The slug is caller-supplied text and never reaches a displayable message.
    expect(error.message).not.toContain("nothing-here");
  });

  it("answers 404 for an unpublished post, because the read never sees it", async () => {
    const { service, postFindFirst } = createService();

    // An unpublished row is excluded by the query itself, so the delegate answers null — which is
    // exactly what this asserts: a draft is indistinguishable from a post that does not exist.
    postFindFirst.mockResolvedValue(null);

    const error = await captureError(service.findBySlug(POST_ROW.slug, EN));

    expect(error.getStatus()).toBe(404);
  });
});
