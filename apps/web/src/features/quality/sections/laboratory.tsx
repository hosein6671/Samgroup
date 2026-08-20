import { ANCHORS } from "../quality-anchors";

import type { ContentFigure, QualityLaboratory } from "@sam-group/types";
import type { ReactNode } from "react";

/**
 * 3 · Laboratory Capability — SITE_STRUCTURE §7's test list.
 *
 * ── The register carries names and only names ───────────────────────────────
 *
 * Properties, in the source's order, with no method beside any of them, no condition, no unit and
 * no value. That is not a rendering choice this component makes: `QualityProperty` has one field,
 * the Payload `properties` array has one field, and the API projection reads one field. There is
 * nowhere for a standard designation, a temperature or a result to arrive from.
 *
 * The category template's specification table established why: an audit found that **no document in
 * this project names a single test standard**, and a designation cited wrongly against a real
 * property is a technical error a buyer would specify against.
 *
 * ── What is withheld is listed, not implied ─────────────────────────────────
 *
 * The withheld attributes are CMS content and are rendered as ordinary text — each with its reason
 * directly beneath it, never in a tooltip and never behind a hover. In particular the
 * in-house/external split: §7 marks it `[TO CONFIRM]`, so the page claims neither and says that it
 * claims neither. A "Laboratory Capability" section that stays silent on that point is read as
 * claiming every property in-house.
 *
 * ── The photograph is optional, and its absence is silent ───────────────────
 *
 * The drafting-table frame that stood here through the proof stage — the "Image pending" marker, the
 * commissioned alt text, the registration marks — went with the fixture. It was proof-state
 * furniture describing an unfinished *asset*, and it has no place on a page reading from the CMS.
 * With no upload the section renders no `<figure>` at all and the layout collapses to one column.
 */
export function QualityLaboratorySection({
  laboratory,
}: {
  readonly laboratory: QualityLaboratory;
}): ReactNode {
  const {
    eyebrow,
    heading,
    lead,
    registerLabel,
    orderNote,
    properties,
    unpublishedHeading,
    unpublished,
    figure,
  } = laboratory;

  return (
    <section className="fs-sec qc-lab" id={ANCHORS.laboratory} data-surface="midnight">
      <div className="fs-blueprint" aria-hidden="true" />

      <div className="fs-wrap qc-lab-inner">
        <div className="qc-lab-top" data-figure={figure === null ? "no" : "yes"}>
          {(eyebrow !== null || heading !== null || lead !== null) && (
            <header className="qc-lab-head reveal-fade-rise">
              {/* Localized CMS copy, with no English fallback — see `sections/approach.tsx`. */}
              {eyebrow !== null && <p className="fs-eyebrow">{eyebrow}</p>}
              {heading !== null && <h2 className="fs-d2">{heading}</h2>}
              {lead !== null && <p className="fs-lead">{lead}</p>}
            </header>
          )}

          {figure !== null && (
            <LaboratoryFigure figure={figure} className="qc-lab-media reveal-fade-rise" />
          )}
        </div>

        {properties.length > 0 && (
          <div className="qc-register reveal-fade-rise">
            {registerLabel !== null && (
              <p className="qc-register-head">
                <span>{registerLabel}</span>
                <span className="fs-tnum">
                  {String(properties.length).padStart(2, "0")}
                  {orderNote !== null && ` · ${orderNote}`}
                </span>
              </p>
            )}

            <ol className="qc-register-list">
              {properties.map((property, i) => (
                <li className="qc-property" key={property.name}>
                  <span className="qc-property-num fs-tnum">{String(i + 1).padStart(2, "0")}</span>
                  <span className="qc-property-name">{property.name}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {unpublished.length > 0 && (
          <div className="qc-pending reveal-fade-rise">
            {unpublishedHeading !== null && (
              <h3 className="qc-pending-head">
                <span aria-hidden="true">◇</span>
                {unpublishedHeading}
              </h3>
            )}

            <ul className="qc-pending-list">
              {unpublished.map((item) => (
                <li key={item.name}>
                  <b>{item.name}</b>
                  <span>{item.why}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * The laboratory photograph.
 *
 * ── Why a plain `<img>` and not `next/image` ────────────────────────────────
 *
 * Editorial media URLs are **origin-relative** (`/media/cms/<file>`) and served from this site's own
 * origin by nginx, so there is no remote pattern to configure and nothing cross-origin to optimise.
 * Adopting `next/image` here would mean choosing a loader and an optimisation topology for a
 * deployment target that does not exist yet. Intrinsic `width`/`height` come from the CMS record, so
 * the layout does not shift while the file loads — the reason `next/image` is usually reached for.
 * The same trade `SectionFigure` records on the About page.
 *
 * ── Alt text comes from the Media record ────────────────────────────────────
 *
 * Required and localized on the upload itself, which is the platform's single place for describing
 * an image. An empty string is the correct fallback rather than invented text: it marks the image
 * decorative to assistive technology instead of announcing a guess.
 *
 * ── A knowing second copy, and it stays one ─────────────────────────────────
 *
 * `features/about/sections/hero.tsx` exports an equivalent `SectionFigure`, whose classes are
 * declared in `about.css`. Importing it would pull another page's layout stylesheet in for one
 * figure, and promoting the vocabulary to the design system is a shared-CSS task this gate does not
 * carry. The duplication is recorded rather than silent.
 */
function LaboratoryFigure({
  figure,
  className,
}: {
  readonly figure: ContentFigure;
  readonly className?: string;
}): ReactNode {
  const { image, caption } = figure;

  return (
    <figure className={className === undefined ? "qc-slot" : `qc-slot ${className}`}>
      <div className="qc-slot-frame">
        <img
          className="qc-slot-image"
          src={image.url}
          alt={image.alt ?? ""}
          {...(image.width !== null && { width: image.width })}
          {...(image.height !== null && { height: image.height })}
          loading="lazy"
          decoding="async"
        />
      </div>
      {caption !== null && (
        <figcaption className="qc-slot-caption">
          <span className="qc-slot-cap">{caption}</span>
        </figcaption>
      )}
    </figure>
  );
}
