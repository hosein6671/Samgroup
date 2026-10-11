import {
  structuralImage,
  structuralList,
  structuralSection,
  type StructuralFields,
} from "@/features/content/structural-copy";
import type { ReactNode } from "react";

import { INDUSTRIES } from "../home-data";
import { IndustriesAccordion } from "./industries-accordion";

/**
 * 6 · Industries We Serve — Concept 03's photo accordion.
 *
 * Five industries, five photographs; the open panel widens and shows its line of copy. Editable in
 * /admin: the head (`industries` text slots), each industry's name and line (`industries` list) and
 * each photograph (`industry_1` to `industry_5`). The photographs sit behind their own caption, so
 * their fallback alt is empty; an editor's Media alt is used when one is set.
 */
export function Industries({
  editorial,
}: { readonly editorial?: StructuralFields } = {}): ReactNode {
  const copy = structuralSection("home", "industries", editorial);
  const items = structuralList(editorial, "industries", INDUSTRIES).map((item) => {
    const photo = structuralImage(editorial, item.photo, "") ?? { src: item.src, alt: "" };
    return { key: item.photo, name: item.name, body: item.body, src: photo.src, alt: photo.alt };
  });

  return (
    <section className="fs-sec fs-ind2" id="industries" data-surface="midnight">
      <div className="fs-wrap">
        <div className="fs-ind2-head">
          <p className="fs-sr">{copy.text("industries_we_serve")}</p>
          <h2 className="fs-d2">{copy.text("where_these_products_go_to")}</h2>
          <p className="fs-lead">{copy.text("the_same_catalogue_reaches_five")}</p>
        </div>
        {items.length > 0 && <IndustriesAccordion items={items} />}
      </div>
    </section>
  );
}
