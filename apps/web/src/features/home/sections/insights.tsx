import { structuralSection, type StructuralFields } from "@/features/content/structural-copy";
import Image from "next/image";
import type { ReactNode } from "react";

import { PublishedDate } from "@/features/blog/published-date";
import { Arrow } from "@/features/site/logo-mark";
import { localeHref, ROUTES } from "@/features/site/site-routes";

import { PhotoBrand } from "../branded-photo";

import type { BlogPostListItemResponse } from "@sam-group/types";

/**
 * 8 · Insights — the newest article large, the next two small beside it.
 *
 * The posts are the real ones: `app/[locale]/page.tsx` fetches the newest three published articles
 * and hands them down as `recentPosts`, already resolved, so this stays a Server Component. Each
 * post's photograph, category, date and title come from the blog Admin; the heading, lead and
 * action come from the Home page's `insights` text slots.
 *
 * **The lead article's text sits on its photograph.** A scrim runs from transparent to near-opaque
 * ink behind the text, so any photograph an editor uploads keeps white text readable. The lead
 * photograph carries the same SAM GROUP badge as the site's other photographs, in its top corner,
 * clear of the text at the bottom; the small thumbnails stay plain.
 *
 * The layout is always the design's: the lead article on the left, the side column on the right.
 * With fewer than three published articles the free space in the side column becomes one "Explore
 * insights" card linking to the Insights page; none at all leaves the heading and its action, the
 * same as before any article existed. No placeholder article, no fabricated row.
 */
const SIDE_COUNT = 2;

function articleHref(locale: string, post: BlogPostListItemResponse): string {
  return localeHref(locale, `${ROUTES.insights}/${post.slug}`);
}

function Meta({
  post,
  locale,
}: {
  readonly post: BlogPostListItemResponse;
  readonly locale: string;
}): ReactNode {
  return (
    <p className="fs-ins-meta">
      <b>{post.category.name}</b>
      <PublishedDate iso={post.publishedAt} locale={locale} />
    </p>
  );
}

export function Insights({
  locale,
  editorial,
  recentPosts,
}: {
  readonly locale: string;
  readonly editorial?: StructuralFields;
  readonly recentPosts: readonly BlogPostListItemResponse[];
}): ReactNode {
  const copy = structuralSection("home", "insights", editorial);
  const [lead, ...rest] = recentPosts;
  const side = rest.slice(0, SIDE_COUNT);

  return (
    <section className="fs-sec fs-insights" id="insights" data-surface="light">
      <div className="fs-wrap">
        <div className="fs-ins-top">
          <div>
            <p className="fs-sr">{copy.text("sam_group_insights")}</p>
            <h2 className="fs-d2">{copy.text("practical_knowledge_for_better_product")}</h2>
            <p className="fs-lead">{copy.rich("read_clear_guidance_on_product")}</p>
          </div>
          <a href={localeHref(locale, ROUTES.insights)} className="fs-btn fs-btn--outline">
            {copy.text("explore_insights")}
            <Arrow />
          </a>
        </div>

        {lead && (
          <div className="fs-ins-grid">
            <a className="fs-ins-lead" href={articleHref(locale, lead)}>
              <div
                className="fs-photo fs-ins-photo"
                data-image={lead.featuredImage ? "true" : "false"}
              >
                {lead.featuredImage && (
                  <Image
                    src={lead.featuredImage.url}
                    alt={lead.featuredImage.altText ?? ""}
                    fill
                    sizes="(max-width: 960px) calc(100vw - 40px), 58vw"
                  />
                )}
                <PhotoBrand />
                <div className="fs-ins-overlay">
                  <Meta post={lead} locale={locale} />
                  <h3>{lead.title}</h3>
                </div>
              </div>
            </a>

            <div className="fs-ins-side" data-posts={side.length}>
              {side.map((post) => (
                <a className="fs-ins-mini" href={articleHref(locale, post)} key={post.id}>
                  {post.featuredImage && (
                    <div className="fs-ins-thumb">
                      <Image
                        src={post.featuredImage.url}
                        alt={post.featuredImage.altText ?? ""}
                        fill
                        sizes="(max-width: 960px) 38vw, 200px"
                      />
                    </div>
                  )}
                  <div>
                    <Meta post={post} locale={locale} />
                    <h3>{post.title}</h3>
                  </div>
                </a>
              ))}
              {/* Fewer than three articles: the free space becomes the way to the rest, never a
                  placeholder article. */}
              {side.length < SIDE_COUNT && (
                <a className="fs-ins-more" href={localeHref(locale, ROUTES.insights)}>
                  <span>{copy.text("explore_insights")}</span>
                  <Arrow size={22} />
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
