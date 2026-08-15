import { Test } from "@nestjs/testing";

import { LocaleResolutionService } from "../../common/locale/locale-resolution.service";

import { BlogPostsController } from "./blog-posts.controller";
import { BlogPostsService } from "./blog-posts.service";

import type { BlogPostListQuery } from "./dto/blog-post-list.query";
import type { BlogPostDetailResponse, BlogPostListItemResponse } from "./dto/blog-post.response";
import type { ResolvedLocale } from "../../common/locale/resolved-locale";

const EN: ResolvedLocale = { code: "en", defaultCode: "en", isDefault: true };

const CATEGORY = { name: "Demo Category", slug: "sam-demo-insights" };

const LIST_ITEM: BlogPostListItemResponse = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Understanding Base Oil Groups",
  slug: "sam-demo-understanding-base-oil-groups",
  publishedAt: "2026-03-04T10:00:00.000Z",
  category: CATEGORY,
};

const DETAIL: BlogPostDetailResponse = {
  id: LIST_ITEM.id,
  title: LIST_ITEM.title,
  slug: LIST_ITEM.slug,
  content: "DEMO / PLACEHOLDER CONTENT.",
  publishedAt: LIST_ITEM.publishedAt,
  category: CATEGORY,
  tags: [],
};

type Harness = {
  controller: BlogPostsController;
  findAll: jest.Mock;
  findBySlug: jest.Mock;
  resolve: jest.Mock;
};

async function createHarness(): Promise<Harness> {
  const findAll = jest.fn().mockResolvedValue({
    posts: [LIST_ITEM],
    total: 1,
    page: 1,
    limit: 12,
    localeFallback: false,
  });
  const findBySlug = jest.fn().mockResolvedValue({ post: DETAIL, localeFallback: false });
  const resolve = jest.fn().mockResolvedValue(EN);

  const moduleRef = await Test.createTestingModule({
    controllers: [BlogPostsController],
    providers: [
      { provide: BlogPostsService, useValue: { findAll, findBySlug } },
      { provide: LocaleResolutionService, useValue: { resolve } },
    ],
  }).compile();

  return { controller: moduleRef.get(BlogPostsController), findAll, findBySlug, resolve };
}

describe("BlogPostsController.findAll", () => {
  it("resolves the locale before querying the blog", async () => {
    const { controller, resolve, findAll } = await createHarness();

    await controller.findAll({ locale: "fa" });

    expect(resolve).toHaveBeenCalledWith("fa");
    expect(findAll).toHaveBeenCalledWith(EN, { locale: "fa" });
  });

  it("passes the filter, pagination and sort parameters straight through", async () => {
    const { controller, findAll } = await createHarness();
    const query: BlogPostListQuery = {
      category: "sam-demo-insights",
      page: 2,
      limit: 5,
      sort: "publishedAt",
    };

    await controller.findAll(query);

    expect(findAll).toHaveBeenCalledWith(EN, query);
  });

  it("returns the posts as the envelope's data", async () => {
    const { controller } = await createHarness();

    const response = await controller.findAll({});

    expect(response.data).toEqual([LIST_ITEM]);
  });

  // API_DESIGN.md §Pagination & Filtering: list responses ALWAYS carry total, page and limit.
  it("always reports total, page and limit in meta", async () => {
    const { controller } = await createHarness();

    const response = await controller.findAll({});

    expect(response.meta).toEqual({ total: 1, page: 1, limit: 12 });
  });

  it("adds localeFallback to meta only when something actually fell back", async () => {
    const { controller, findAll } = await createHarness();

    findAll.mockResolvedValue({
      posts: [LIST_ITEM],
      total: 1,
      page: 1,
      limit: 12,
      localeFallback: true,
    });

    const response = await controller.findAll({});

    expect(response.meta).toEqual({ total: 1, page: 1, limit: 12, localeFallback: true });
  });
});

describe("BlogPostsController.findOne", () => {
  it("resolves the locale and forwards the slug verbatim", async () => {
    const { controller, resolve, findBySlug } = await createHarness();

    await controller.findOne("sam-demo-understanding-base-oil-groups", { locale: "ar" });

    expect(resolve).toHaveBeenCalledWith("ar");
    expect(findBySlug).toHaveBeenCalledWith("sam-demo-understanding-base-oil-groups", EN);
  });

  it("returns the post as the envelope's data, with empty meta when nothing fell back", async () => {
    const { controller } = await createHarness();

    const response = await controller.findOne(DETAIL.slug, {});

    expect(response.data).toEqual(DETAIL);
    expect(response.meta).toEqual({});
  });

  it("reports localeFallback on the detail response when the service raises it", async () => {
    const { controller, findBySlug } = await createHarness();

    findBySlug.mockResolvedValue({ post: DETAIL, localeFallback: true });

    const response = await controller.findOne(DETAIL.slug, { locale: "fa" });

    expect(response.meta).toEqual({ localeFallback: true });
  });
});
