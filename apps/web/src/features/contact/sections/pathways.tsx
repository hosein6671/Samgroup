import { Arrow } from "@/features/site/logo-mark";

import { ANCHORS } from "../contact-data";

import type { ReactNode } from "react";

const PATHWAYS = [
  {
    code: "PI",
    title: "Product information",
    detail: "Identify a family, product, grade, application, or document needed for evaluation.",
    type: "product_inquiry",
  },
  {
    code: "RQ",
    title: "Request a quote",
    detail: "Define product, quantity, packaging, destination, and trade-term context.",
    type: "request_a_quote",
  },
  {
    code: "SR",
    title: "Sample request",
    detail: "Name the product and intended evaluation so the request can be reviewed in context.",
    type: "sample_request",
  },
  {
    code: "EL",
    title: "Export & logistics",
    detail: "Share the destination, preferred packaging, shipment basis, and known constraints.",
    type: "export_and_logistics",
  },
] as const;

export function ContactPathways({ locale }: { readonly locale: string }): ReactNode {
  return (
    <section className="ct-pathways" data-surface="midnight" aria-labelledby="ct-pathways-title">
      <div className="fs-wrap ct-pathways-inner">
        <header className="ct-pathways-head reveal-fade-rise">
          <p className="fs-eyebrow">Choose an enquiry path</p>
          <h2 className="fs-d3" id="ct-pathways-title">
            Start with the decision you need to make.
          </h2>
        </header>

        <ol className="ct-pathways-list reveal-stagger">
          {PATHWAYS.map((pathway) => (
            <li key={pathway.type}>
              <a href={`/${locale}/contact-us?type=${pathway.type}#${ANCHORS.form}`}>
                <span className="ct-pathway-code fs-tnum">{pathway.code}</span>
                <span className="ct-pathway-copy">
                  <strong>{pathway.title}</strong>
                  <small>{pathway.detail}</small>
                </span>
                <Arrow size={15} />
              </a>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
