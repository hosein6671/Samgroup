import type { ReactNode } from "react";

export function ProductTechnicalDocuments(): ReactNode {
  const documents = [
    {
      code: "TDS",
      title: "Technical Data Sheet",
      detail:
        "Use the current issued sheet to review published properties, test methods and product guidance.",
    },
    {
      code: "SDS",
      title: "Safety Data Sheet",
      detail:
        "Use the market-applicable sheet for hazards, handling, storage, transport and emergency information.",
    },
    {
      code: "COA",
      title: "Certificate of Analysis",
      detail:
        "Where supplied, the batch document reports the tested results associated with that batch.",
    },
  ] as const;

  return (
    <section className="fs-sec pd-docs" data-surface="midnight" id="technical-documents">
      <div className="fs-blueprint" aria-hidden="true" />
      <div className="fs-wrap pd-docs-inner">
        <header className="pd-section-head reveal-fade-rise">
          <p className="fs-eyebrow">Technical documents</p>
          <h2 className="fs-d2">Review the issued document, not an assumption.</h2>
          <p className="fs-lead">
            Request the current document set for the product, market and batch context relevant to
            your enquiry.
          </p>
        </header>
        <div className="pd-document-grid reveal-stagger">
          {documents.map((document) => (
            <article key={document.code}>
              <span>{document.code}</span>
              <h3>{document.title}</h3>
              <p>{document.detail}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
