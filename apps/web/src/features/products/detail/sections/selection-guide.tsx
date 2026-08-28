import type { ReactNode } from "react";

import { BrandedPhoto } from "@/features/home/branded-photo";

import type { ProductDetailEditorial } from "../product-detail-content";

export function ProductSelectionGuide({
  editorial,
}: {
  readonly editorial: ProductDetailEditorial;
}): ReactNode {
  return (
    <section className="fs-sec pd-selection" data-surface="light">
      <div className="fs-wrap pd-selection-grid">
        <div className="pd-selection-media reveal-fade-rise">
          <BrandedPhoto
            src={editorial.image.src}
            alt={editorial.image.alt}
            caption={editorial.image.caption}
            className="pd-family-photo"
            sizes="(max-width: 900px) 100vw, 48vw"
          />
        </div>

        <div className="pd-selection-copy reveal-fade-rise">
          <p className="fs-eyebrow">{editorial.selection.eyebrow}</p>
          <h2 className="fs-d2">{editorial.selection.heading}</h2>
          <p className="fs-lead">{editorial.selection.introduction}</p>

          <ol className="pd-criteria">
            {editorial.selection.criteria.map((criterion, index) => (
              <li key={criterion.title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h3>{criterion.title}</h3>
                  <p>{criterion.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
