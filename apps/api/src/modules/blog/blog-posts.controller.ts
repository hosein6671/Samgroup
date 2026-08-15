import { Controller, Get, Param, Query } from "@nestjs/common";

import { LocaleResolutionService } from "../../common/locale/locale-resolution.service";
import { LocaleQuery } from "../../common/locale/locale.query";
import { withMeta } from "../../common/http/with-meta";

import { BlogPostsService } from "./blog-posts.service";
import { BlogPostListQuery } from "./dto/blog-post-list.query";

import type { BlogPostDetailResponse, BlogPostListItemResponse } from "./dto/blog-post.response";
import type { ResponseWithMeta } from "../../common/http/with-meta";

/**
 * Blog / Insights reads — `GET /blog/posts` and `GET /blog/posts/:slug`.
 *
 * ── These two paths are an ADDITION to API_CONTRACT_FINAL.md §2 ─────────────
 *
 * The contract's only public blog read is `GET /pages/insights` (§2.5), a page-composition endpoint
 * that composes "Insights Global + paginated posts + blog categories" — and the Global half is
 * Payload, which is not implemented and must not be introduced here. §2.5 also states that the
 * composition endpoints are "additive, not a replacement" and that resource endpoints "remain the
 * foundation", while listing no blog resource endpoint at all: an article detail page therefore has
 * no endpoint anywhere in the contract, which is a gap rather than an exclusion.
 *
 * These two fill it in the shape §2.3 already fixes for the catalog — list plus locale-specific
 * slug, same envelope, same pagination, same `localeFallback`. The contract is updated to record
 * them; see docs/API_CONTRACT_FINAL.md §2.3a.
 *
 * Both are public: no token, and the published filter is `BlogPost.publishedAt` rather than a role
 * check (§6 fixes that definition). Write endpoints are out of scope — blog CRUD is an Admin
 * surface (§5) and no write path exists here by decision.
 *
 * The controller's whole job is request shape → resolved locale → service → envelope. Every handler
 * resolves the locale first, so an unknown `?locale=` answers INVALID_LOCALE without a blog query
 * ever running.
 */
@Controller("blog/posts")
export class BlogPostsController {
  constructor(
    private readonly blogPostsService: BlogPostsService,
    private readonly localeResolution: LocaleResolutionService,
  ) {}

  /**
   * `meta.total/page/limit` are always present on this response, per API_DESIGN.md §Pagination &
   * Filtering ("list responses always include..."), while `localeFallback` appears only when
   * something actually fell back (API_CONTRACT_FINAL.md §3).
   */
  @Get()
  async findAll(
    @Query() query: BlogPostListQuery,
  ): Promise<ResponseWithMeta<BlogPostListItemResponse[]>> {
    const locale = await this.localeResolution.resolve(query.locale);
    const { posts, total, page, limit, localeFallback } = await this.blogPostsService.findAll(
      locale,
      query,
    );

    return withMeta(
      posts,
      localeFallback ? { total, page, limit, localeFallback: true } : { total, page, limit },
    );
  }

  /** `:slug` is the locale-specific slug, so the same post answers to a different path per locale. */
  @Get(":slug")
  async findOne(
    @Param("slug") slug: string,
    @Query() query: LocaleQuery,
  ): Promise<ResponseWithMeta<BlogPostDetailResponse>> {
    const locale = await this.localeResolution.resolve(query.locale);
    const { post, localeFallback } = await this.blogPostsService.findBySlug(slug, locale);

    return withMeta(post, localeFallback ? { localeFallback: true } : {});
  }
}
