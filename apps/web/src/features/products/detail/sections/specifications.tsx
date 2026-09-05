import { VisuallyHidden } from "@sam-group/ui";
import type { ReactNode } from "react";

import { TechnicalDataPendingIcon } from "@/features/site/icons";

import type { ProductSpecificationResponse } from "@sam-group/types";

/**
 * A `resultBasis` of `unspecified` is the column's own default — "no claim was made about what
 * this number is" — and is never itself a public claim, so its cell renders the same "Not
 * applicable" mark as any other field this row has nothing to state for, rather than a chip
 * reading "Unspecified".
 */
const BASIS_LABEL: Partial<Record<ProductSpecificationResponse["resultBasis"], string>> = {
  average: "Average",
  typical: "Typical",
  specification_limit: "Limit",
  measured: "Measured",
};

/**
 * The SHAPE of a value (ADR-014 §3) — read off `valueType`, never inferred from the printed
 * string. `point`/`text`/`report_only`/`code` render no badge: a plain single reading is the
 * default case and needs no label to distinguish it from itself.
 */
const SHAPE_LABEL: Partial<Record<NonNullable<ProductSpecificationResponse["valueType"]>, string>> =
  {
    range: "Range",
    minimum: "Minimum",
    maximum: "Maximum",
    pair: "Paired reading",
  };

/** Announced for a field this row genuinely has nothing to state — never "pending", never blank. */
const NOT_APPLICABLE = "Not applicable";

/**
 * The Value/Unit reading, exactly as `value` (already the reviewer's normalized `displayValue`
 * where one exists, ADR-014 §9) plus a shape badge where `valueType` names one. Shared between
 * the desktop table's Value column and the mobile card's Value row — one rendering, not two.
 */
function SpecificationValue({
  specification,
}: {
  readonly specification: ProductSpecificationResponse;
}): ReactNode {
  const shapeLabel =
    specification.valueType === null ? undefined : SHAPE_LABEL[specification.valueType];

  return (
    <>
      {shapeLabel !== undefined && <span className="pd-value-shape">{shapeLabel}</span>}
      {specification.value}
      {specification.unit !== null && specification.unit !== "" && (
        <span className="pd-unit">{specification.unit}</span>
      )}
    </>
  );
}

/** A table cell for a field this row may or may not carry — Grade, Basis, Method, Condition. */
function OptionalCell({ children }: { readonly children: ReactNode | null }): ReactNode {
  if (children === null) {
    return (
      <td data-empty="true">
        <VisuallyHidden>{NOT_APPLICABLE}</VisuallyHidden>
      </td>
    );
  }

  return <td>{children}</td>;
}

/** The same optional field, as a labelled record row in the mobile card. */
function OptionalRow({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode | null;
}): ReactNode {
  return (
    <div className="pd-spec-row">
      <dt>{label}</dt>
      {children === null ? (
        <dd data-empty="true">
          <VisuallyHidden>{NOT_APPLICABLE}</VisuallyHidden>
        </dd>
      ) : (
        <dd>{children}</dd>
      )}
    </div>
  );
}

function basisText(specification: ProductSpecificationResponse): ReactNode | null {
  return BASIS_LABEL[specification.resultBasis] ?? null;
}

function gradeText(specification: ProductSpecificationResponse): ReactNode | null {
  return specification.grade === null ? null : specification.grade.label;
}

function methodText(specification: ProductSpecificationResponse): ReactNode | null {
  return specification.method === null || specification.method === "" ? null : specification.method;
}

function conditionText(specification: ProductSpecificationResponse): ReactNode | null {
  return specification.qualifier === null || specification.qualifier === ""
    ? null
    : specification.qualifier;
}

/**
 * `specifications` is empty for a product the platform genuinely holds — nothing exists yet to
 * review, or review has not approved a row yet — never for a product that failed to load. That
 * second case is `ProductUnavailable` (`product-unavailable.tsx`), rendered by
 * `app/[locale]/products/[slug]/page.tsx` on an entirely separate branch when `resolveProduct()`
 * itself fails; `ProductDetailTemplate` only ever reaches this component with a real,
 * successfully-resolved product, so the panel below can say "under review" without risk of
 * describing an outage as a content state.
 *
 * No heading, no icon and no copy here may ever be produced by an API failure — that would be the
 * one way this state could mislead a visitor into believing a broken request was a quiet product.
 */
const PENDING_HEADING = "Technical data";
const PENDING_STATUS = "Technical data is under review.";

/**
 * The empty state: a product exists, and has no published technical dataset yet.
 *
 * No placeholder rows, no invented values, no reference to any other manufacturer, and no
 * PDF/download action — this is a status line, not a table with the data missing. See the doc
 * comment on `PENDING_STATUS` above for why this must never be reachable from an API failure.
 */
function SpecificationsPending(): ReactNode {
  return (
    <section className="fs-sec pd-specs pd-specs--pending" id="specifications" data-surface="light">
      <div className="fs-wrap">
        <header className="pd-section-head reveal-fade-rise">
          <p className="fs-eyebrow">Specifications</p>
          <h2 className="fs-d2">{PENDING_HEADING}</h2>
        </header>
        <p className="pd-specs-pending reveal-fade-rise">
          <TechnicalDataPendingIcon size="lg" />
          {PENDING_STATUS}
        </p>
      </div>
    </section>
  );
}

/**
 * The product's published specifications — `Specification` rows, exactly as the API returns them.
 *
 * ── An empty array is a real, distinct state, not an absent section ────────
 *
 * `SpecificationsPending` above covers `specifications.length === 0` — see its own comment for why
 * this is never reachable from a failed request. This is a different decision from the Product
 * FAMILY pages, and the difference is worth stating because the two look contradictory side by
 * side. A family page renders its full property axis with every cell marked unpublished, because
 * the axis itself is approved content from SITE_STRUCTURE §7 — the columns are a real statement
 * about what is measured. A product has no approved axis of its own, so an empty set here is not
 * "an approved table awaiting values" either — it is the honest absence of any row, said plainly
 * rather than rendered as a table with nothing in it.
 *
 * ── Rendered verbatim, and never interpreted ────────────────────────────────
 *
 * `key`, `value` and `unit` are printed as they arrive. Nothing here maps a key to a friendlier
 * label, infers a unit, sorts by a preferred property order, or groups rows — every one of those
 * would be this component asserting technical knowledge about the catalog that no approved document
 * supplies. The API already orders the rows stably (by key, then value); that order is kept.
 *
 * `grade`, `method`, `qualifier` (rendered as "Condition" — a test condition, never merged into
 * the property name or into `method`) and `resultBasis` are the same kind of verbatim field: a
 * grade label is printed exactly as the source stated it, a method exactly as recorded, and a
 * basis renders only as one of the five fixed values the database itself constrains it to.
 * `valueType` drives no printed text at all — only which shape badge, if any, precedes the value
 * — because `displayValue` is already guaranteed correct wherever `valueType` is set (ADR-014
 * §9's `specifications_normalized_complete` CHECK), so nothing here reconstructs a number from
 * `numericMin`/`numericMax`/`pairFirst`/`pairSecond`.
 *
 * ── Six explicit relationships, not one decorated pair ──────────────────────
 *
 * Property, Grade, Value (with Unit riding beside it — the one pairing this page combines
 * visually, because a number and what it is measured in stays one explicit reading), Basis,
 * Method and Condition are six real, independent columns on desktop and six labelled fields in
 * every mobile card. None of the four technical fields is folded into decorative text beside
 * another — a reviewer approved each one as its own fact, and each stays legible as one.
 *
 * `key` may legitimately repeat — the schema carries no unique on (product, key), because one
 * product can publish the same property once per grade — so `id` is the React key, never `key`.
 *
 * A Server Component. A real `<table>` for desktop and a genuinely separate, genuinely labelled
 * card list for narrow screens (see product-detail.css's NARROW section for why these are two
 * markups rather than one table reflowed by CSS) — no JavaScript in either.
 */
export function ProductSpecifications({
  specifications,
}: {
  readonly specifications: readonly ProductSpecificationResponse[];
}): ReactNode {
  if (specifications.length === 0) return <SpecificationsPending />;

  return (
    <section className="fs-sec pd-specs" id="specifications" data-surface="light">
      <div className="fs-wrap">
        <header className="pd-section-head reveal-fade-rise">
          <p className="fs-eyebrow">Specifications</p>
          <h2 className="fs-d2">Published values</h2>
        </header>

        <div className="pd-table-wrap reveal-fade-rise">
          <table className="pd-table">
            <caption>Specification values as published for this product.</caption>
            <thead>
              <tr>
                <th scope="col">Property</th>
                <th scope="col">Grade</th>
                <th scope="col">Value</th>
                <th scope="col">Basis</th>
                <th scope="col">Method</th>
                <th scope="col">Condition</th>
              </tr>
            </thead>
            <tbody>
              {specifications.map((specification) => (
                <tr key={specification.id}>
                  <th scope="row">{specification.key}</th>
                  <OptionalCell>{gradeText(specification)}</OptionalCell>
                  <td>
                    <SpecificationValue specification={specification} />
                  </td>
                  <OptionalCell>{basisText(specification)}</OptionalCell>
                  <OptionalCell>{methodText(specification)}</OptionalCell>
                  <OptionalCell>{conditionText(specification)}</OptionalCell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/*
          The same rows, as accessible stacked records — see product-detail.css's NARROW section.
          Always in the DOM; CSS shows exactly one of the two per breakpoint, which is what keeps
          a screen reader from ever meeting either the row/column associations broken or the
          content announced twice.
        */}
        <ul className="pd-spec-cards reveal-fade-rise">
          {specifications.map((specification) => (
            <li className="pd-spec-card" key={specification.id}>
              <dl>
                <div className="pd-spec-row pd-spec-row--property">
                  <dt>Property</dt>
                  <dd>{specification.key}</dd>
                </div>
                <OptionalRow label="Grade">{gradeText(specification)}</OptionalRow>
                <div className="pd-spec-row">
                  <dt>Value</dt>
                  <dd>
                    <SpecificationValue specification={specification} />
                  </dd>
                </div>
                <OptionalRow label="Basis">{basisText(specification)}</OptionalRow>
                <OptionalRow label="Method">{methodText(specification)}</OptionalRow>
                <OptionalRow label="Condition">{conditionText(specification)}</OptionalRow>
              </dl>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
