import Image from "next/image";
import type { ReactNode } from "react";

import { familyIconFor } from "@/features/site/icons";

import type { ProductImageResponse } from "@sam-group/types";

/**
 * The image-led hero's media side — a large primary image with accessible thumbnail
 * navigation when the product has two or more approved images, or a restrained SAM-branded
 * fallback when it has none.
 *
 * ── No image today, and that stays true for every product this gate can demonstrate ─────────
 *
 * Every catalog product — including the two new Base Oil records — has zero approved images: no
 * `Media` row exists yet, and this gate does not upload one (`Do not upload media or modify
 * Payload/object storage during this gate`). So the fallback below is what every real Product
 * Detail page shows today; the multi-image path is proven by `gallery.spec.tsx`'s rendered-HTML
 * assertions rather than by a live browser screenshot of a real product, honestly, because there
 * is no real product to screenshot it on yet.
 *
 * ── `next/image`, in `fill` mode ─────────────────────────────────────────────
 *
 * `media.url` is an origin-relative path (`/media/products/<file>`), served from this site's own
 * origin, so there is no remote host to declare in `next.config.ts` — the previous objection here
 * assumed one was needed; `hero-v2.tsx` already proves the same relative-URL shape works with
 * `next/image` unchanged. `.pd-gallery-stage`/`.pd-gallery-slide` were already `position: relative`
 * / `position: absolute; inset: 0` in `product-detail.css`, which is `fill`'s own shape exactly —
 * this swap needed no CSS change. `ProductImageResponse` carries no `width`/`height`, which `fill`
 * does not need.
 *
 * ── Selection is CSS, not JavaScript ─────────────────────────────────────────
 *
 * Each thumbnail is a plain link to `#pd-gallery-{image.id}`; each full image carries that id.
 * `:target` shows the linked image and `:has()` (`product-detail.css`'s own SPECIFICATIONS-
 * adjacent rule) hides every other one once any target is active, falling back to the first
 * image by document order otherwise. A link is natively keyboard-focusable and activatable with
 * Enter — no ARIA tab pattern, no keydown handler and no client component are needed for
 * "keyboard-operable thumbnails", because nothing here does anything a browser does not already
 * do for a plain anchor.
 *
 * A Server Component. No lightbox — none of this codebase's established components is a
 * lightbox, and the owner's own instruction is to add one only where an established pattern
 * already exists.
 */
export function ProductGallery({
  images,
  productName,
  familySlug,
}: {
  readonly images: readonly ProductImageResponse[];
  /** Used only for accessible labelling — never printed into an `alt`. */
  readonly productName: string;
  readonly familySlug: string;
}): ReactNode {
  if (images.length === 0)
    return <FamilyFallback productName={productName} familySlug={familySlug} />;

  return (
    <div className="pd-gallery-media">
      <div className="pd-gallery-stage" role="group" aria-label={`Images of ${productName}`}>
        {images.map((image, index) => (
          <Image
            key={image.id}
            id={`pd-gallery-${image.id}`}
            className="pd-gallery-slide"
            src={image.url}
            alt={image.altText ?? ""}
            fill
            sizes="(max-width: 900px) 100vw, 480px"
            loading={index === 0 ? "eager" : "lazy"}
          />
        ))}
      </div>

      {images.length > 1 && (
        <ul className="pd-gallery-thumbs">
          {images.map((image, index) => (
            <li key={image.id}>
              <a
                className="pd-gallery-thumb"
                href={`#pd-gallery-${image.id}`}
                aria-label={`Show image ${String(index + 1)} of ${String(images.length)}`}
              >
                <Image src={image.url} alt="" fill sizes="64px" loading="lazy" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The branded fallback for a product with no approved photograph — the family's own glyph on a
 * quiet Flagship surface, clearly a placeholder rather than an attempt at a product photograph.
 * No stock imagery, no invented pack shot, no fabricated label, factory, machine, laboratory,
 * certificate or application scene: exactly the family icon already used in navigation, and the
 * product's own name, printed as text rather than drawn into anything resembling a photograph.
 */
function FamilyFallback({
  productName,
  familySlug,
}: {
  readonly productName: string;
  readonly familySlug: string;
}): ReactNode {
  const FamilyIcon = familyIconFor(familySlug);

  return (
    <div className="pd-gallery-fallback">
      {FamilyIcon && <FamilyIcon size="xl" />}
      <p>{productName}</p>
      <span>Product image pending</span>
    </div>
  );
}
