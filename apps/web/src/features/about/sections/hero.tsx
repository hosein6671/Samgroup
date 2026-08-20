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
          />
        )}
      </div>
    </section>
  );
}

/**
 * A section photograph, in the frame the page already had.
 *
 * ── Why a plain `<img>` and not `next/image` ────────────────────────────────
 *
 * Editorial media URLs are **origin-relative** (`/media/cms/<file>`) and served from this site's own
 * origin by nginx, so there is no remote pattern to configure and nothing cross-origin to optimise.
 * Adopting `next/image` here would mean choosing a loader and an optimisation topology for a
 * deployment target that does not exist yet (DEVOPS.md's VPS is unacquired), which is a decision,
 * not a detail. Intrinsic `width`/`height` come from the CMS record, so the layout does not shift
 * while the file loads — the reason `next/image` is usually reached for.
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
}: {
  readonly figure: ContentFigure;
  readonly className?: string;
  readonly ratio?: "landscape" | "portrait";
}): ReactNode {
  const { image, caption } = figure;

  return (
    <figure
      className={className === undefined ? "ab-slot" : `ab-slot ${className}`}
      data-ratio={ratio}
    >
      <div className="ab-slot-frame">
        <img
          className="ab-slot-image"
          src={image.url}
          alt={image.alt ?? ""}
          {...(image.width !== null && { width: image.width })}
          {...(image.height !== null && { height: image.height })}
          loading="lazy"
          decoding="async"
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
