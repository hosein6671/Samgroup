import Image from "next/image";

import { Arrow } from "@/features/site/logo-mark";
import { contentRouteHref } from "@/features/site/site-routes";

import type { AboutUsHero, ContentFigure } from "@sam-group/types";
import type { ReactNode } from "react";

/**
 * The About Us hero — the page's `<h1>`, its lead, its two actions and its optional photograph.
 *
 * ── Every part but the heading is optional ──────────────────────────────────
 *
 * The eyebrow, the lead, either action and the figure each render only when the CMS holds one. That
 * is the approved cutover behaviour — a missing optional section renders absent rather than as an
 * empty shell — and it is what lets an editor publish this page before every field is written. The
 * heading is the exception: NestJS never serves this resource without one.
 *
 * ── Destinations are resolved here, not stored ──────────────────────────────
 *
 * A CMS action carries a route *key*. `contentRouteHref` turns it into a locale-prefixed path, so
 * the URL of `/products` stays owned by `site-routes.ts` in all three locales
 * (PROJECT_HANDOFF §6.12).
 */
export function AboutHero({
  hero,
  locale,
}: {
  readonly hero: AboutUsHero;
  readonly locale: string;
}): ReactNode {
  const hasActions = hero.primaryCta !== null || hero.secondaryCta !== null;

  return (
    <section className="ab-hero" data-surface="midnight">
      <div className="fs-blueprint" aria-hidden="true" />
      {/*
       * `data-figure` drives the grid: two columns with a photograph, one without. Without it the
       * copy would keep half the width and the page would carry a large empty column on a page whose
       * imagery has not been uploaded yet.
       */}
      <div className="fs-wrap ab-hero-inner" data-figure={hero.figure === null ? "no" : "yes"}>
        <div className="ab-hero-copy reveal-fade-rise">
          {hero.eyebrow !== null && <p className="fs-eyebrow">{hero.eyebrow}</p>}
          <h1 className="fs-d1">{hero.title}</h1>
          {hero.supportingText !== null && <p className="fs-lead">{hero.supportingText}</p>}
          {hasActions && (
            <div className="ab-hero-actions">
              {hero.primaryCta !== null && (
                <a
                  href={contentRouteHref(locale, hero.primaryCta.route)}
                  className="fs-btn fs-btn--gold"
                >
                  {hero.primaryCta.label}
                  <Arrow size={15} />
                </a>
              )}
              {hero.secondaryCta !== null && (
                <a
                  href={contentRouteHref(locale, hero.secondaryCta.route)}
                  className="fs-btn fs-btn--glass"
                >
                  {hero.secondaryCta.label}
                </a>
              )}
            </div>
          )}
        </div>
        {hero.figure !== null && (
          <SectionFigure
            figure={hero.figure}
            className="ab-hero-media reveal-fade-rise"
            ratio="portrait"
            priority
          />
        )}
      </div>
    </section>
  );
}

/**
 * The fallback intrinsic size fed to `next/image` when the CMS record carries no `width`/`height`
 * of its own — matched to `.ab-slot-frame`'s own CSS `aspect-ratio` for each `ratio` value, so a
 * missing CMS dimension never disagrees with the frame it is about to be cropped into.
 */
const FALLBACK_SIZE: Record<"landscape" | "portrait", { width: number; height: number }> = {
  landscape: { width: 1200, height: 900 },
  portrait: { width: 960, height: 1200 },
};

/**
 * A section photograph, in the frame the page already had.
 *
 * ── `next/image`, with an explicit size ──────────────────────────────────────
 *
 * Editorial media URLs are **origin-relative** (`/media/cms/<file>`) and served from this site's own
 * origin by nginx, so there is no remote pattern to configure and nothing cross-origin to optimise —
 * the deployment-undecided objection this comment used to record no longer applies: the VPS is live,
 * and `hero-v2.tsx` already proves the same relative-URL shape works with `next/image` unchanged.
 * `fill` was considered and rejected here specifically: `.ab-slot-frame` is `padding`ed and its own
 * `::before`/`::after` draw the blueprint field, so an absolutely-positioned `fill` image would flood
 * past that padding to the frame's edge — a real visual regression `laboratory.tsx`'s equivalent
 * frame does not share, because that one has no padding. Explicit `width`/`height` keeps the image a
 * normal grid child instead, exactly as the plain `<img>` it replaces was.
 *
 * ── Alt text comes from the Media record ────────────────────────────────────
 *
 * Required and localized on the upload itself, which is the platform's single place for describing
 * an image. An empty string is the correct fallback rather than invented text: it marks the image
 * decorative to assistive technology instead of announcing a guess.
 */
export function SectionFigure({
  figure,
  className,
  ratio = "landscape",
  priority = false,
}: {
  readonly figure: ContentFigure;
  readonly className?: string;
  readonly ratio?: "landscape" | "portrait";
  readonly priority?: boolean;
}): ReactNode {
  const { image, caption } = figure;

  return (
    <figure
      className={className === undefined ? "ab-slot" : `ab-slot ${className}`}
      data-ratio={ratio}
    >
      <div className="ab-slot-frame">
        <Image
          className="ab-slot-image"
          src={image.url}
          alt={image.alt ?? ""}
          width={image.width ?? FALLBACK_SIZE[ratio].width}
          height={image.height ?? FALLBACK_SIZE[ratio].height}
          sizes="(max-width: 900px) 100vw, 50vw"
          priority={priority}
        />
      </div>
      {caption !== null && (
        <figcaption className="ab-slot-caption">
          <span className="ab-slot-cap">{caption}</span>
        </figcaption>
      )}
    </figure>
  );
}
