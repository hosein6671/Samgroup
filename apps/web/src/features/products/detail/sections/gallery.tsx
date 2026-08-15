import type { ReactNode } from "react";

import type { ProductImageResponse } from "@sam-group/types";

/**
 * The product's public imagery.
 *
 * ── Absent, never substituted ───────────────────────────────────────────────
 *
 * The caller renders this only for a non-empty array. Every product in the database has zero images
 * today, so this section does not appear on any page that currently exists — and that is the
 * required behaviour rather than a gap: there is no stock photograph, no silhouette, no branded
 * placeholder and no "image coming soon" frame anywhere in this file. Inventing product imagery is
 * inventing product content, and a drum photographed under someone else's label would be a claim
 * about packaging that no approved document supports.
 *
 * The page reads correctly without it. The hero carries the name, the description and the
 * classification, and a product with no imagery simply goes from hero to specifications.
 *
 * ── Why `<img>` and not `next/image` ────────────────────────────────────────
 *
 * `next/image` optimises through the Next server, which requires every permitted remote host to be
 * declared in `next.config.ts` under `images.remotePatterns`. The URLs here come from `media.url`
 * in `sam_platform`, pointing at S3-compatible object storage whose production host is explicitly
 * undecided (CLAUDE.md §2, Object store). Declaring a pattern now would be choosing that host in a
 * frontend config file, and leaving it undeclared would make `next/image` throw at render on the
 * first real image.
 *
 * A plain `<img>` has neither problem and costs nothing today, since no image exists. `width` and
 * `height` are not on the wire, so the aspect ratio is held by CSS instead; `loading="lazy"` and
 * `decoding="async"` keep the gallery off the critical path. Revisit with the gate that picks the
 * object store and adds the first real image.
 *
 * `altText` is the API's, verbatim. A null one becomes `alt=""` — an image with no author-supplied
 * description is decorative as far as this page can honestly say, and inventing a description from
 * the product's name would put words in a screen reader's mouth that no editor wrote.
 *
 * A Server Component. No lightbox, no carousel, no JavaScript.
 */
export function ProductGallery({
  images,
  productName,
}: {
  readonly images: readonly ProductImageResponse[];
  /** Used only for the section's accessible label, never printed into an `alt`. */
  readonly productName: string;
}): ReactNode {
  return (
    <section className="fs-sec pd-gallery" id="images" data-surface="light">
      <div className="fs-wrap">
        <header className="pd-section-head reveal-fade-rise">
          <p className="fs-eyebrow">Imagery</p>
          <h2 className="fs-d2">Product images</h2>
        </header>

        <ul className="pd-gallery-grid reveal-stagger" aria-label={`Images of ${productName}`}>
          {images.map((image) => (
            <li key={image.id}>
              <img src={image.url} alt={image.altText ?? ""} loading="lazy" decoding="async" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
