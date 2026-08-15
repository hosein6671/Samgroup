import { Module } from "@nestjs/common";

import { ContentTranslationModule } from "../../common/content/content-translation.module";
import { LocaleResolutionModule } from "../../common/locale/locale-resolution.module";
import { PrismaModule } from "../../prisma/prisma.module";

import { BlogPostsController } from "./blog-posts.controller";
import { BlogPostsService } from "./blog-posts.service";

/**
 * The Blog module — ARCHITECTURE.md §Modules. Owns `BlogPost`, `BlogCategory`, `BlogTag` and
 * `BlogPostTag` in sam_platform, and nothing else.
 *
 * Blog content is **Prisma-owned**, not Payload-owned: SEO_ARCHITECTURE.md §5 states it directly
 * ("Payload holds no blog content and no blog SEO") and FRONTEND_ARCHITECTURE.md gives the Insights
 * routes `Prisma (BlogPost, BlogCategory, BlogTag)` as their data source. Nothing in this module
 * touches the CMS, and it must not gain a Payload dependency without a decision that changes that
 * ownership.
 *
 * `BlogPostsService` is deliberately unexported. `GET /pages/insights` (§2.5) and
 * `GET /pages/home`'s "3 latest posts" will both consume it, and both are unbuilt — exporting ahead
 * of a consumer invites exactly the direct cross-module table access ARCHITECTURE.md §Modules
 * prevents. `/seo/sitemap-entries` does not enumerate blog posts either, and adding them is that
 * module's gate rather than a side effect of this one.
 *
 * No SeoMetaModule and no MediaModule import: this slice serves no `SeoFields` and no imagery, and
 * `BlogPost` has no media relation to resolve. Both are stated as absent rather than left to be
 * inferred, because both would be a reasonable-looking addition made for the wrong reason.
 */
@Module({
  imports: [PrismaModule, LocaleResolutionModule, ContentTranslationModule],
  controllers: [BlogPostsController],
  providers: [BlogPostsService],
})
export class BlogModule {}
