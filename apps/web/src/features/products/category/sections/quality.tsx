import type { ReactNode } from "react";

import { Arrow } from "@/features/site/logo-mark";

import { actionHref } from "../category-contract";
import type { SectionProps } from "../category-section";

/**
 * 5 · Processing and quality — SITE_STRUCTURE §4 item 5.
 *
 * That item is the one place the six category pages are allowed to differ structurally:
 * "Processing & Quality (Base Oil only — Thin Film Polishing block) / Quality & Testing (all
 * others)". `namedProcess` is optional in the contract for exactly that reason — the other five
 * fixtures omit it and this section renders as Quality & Testing with the same three stages.
 *
 * ── The named process carries a name and nothing else ───────────────────────
 *
 * SITE_STRUCTURE names Thin Film Polishing twice — §2 lists it under Our Expertise, §4 makes it
 * this category's distinguishing block — and describes it in neither. Writing what the process
 * does would be writing it here for the first time, which is inventing a process description on
 * a product page. So the callout states the name, says which document owns the description, and
 * stops.
 *
 * ── The stages are documented, not inferred ─────────────────────────────────
 *
 * Incoming, in-process and outgoing are §7's own three testing stages. The test list is the
 * subset of §7's laboratory capability list that applies to a base oil, and it is deliberately
 * printed as property + method pairs rather than as a capability claim: the footnote says
 * plainly that which tests are in-house is stated on Quality & Certifications and not here,
 * because §7 marks that split `[TO CONFIRM]`.
 */
export function CategoryQuality({ content, locale }: SectionProps): ReactNode {
  const { quality } = content;

  return (
    /*
     * `data-named` carries the one structural difference between the two variants of this
     * section. With the callout the side column holds two panels against a three-stage rail; on
     * a category that has no named process it holds one, and the columns rebalance in
     * `category.css` rather than the panel being padded out to keep a symmetry it no longer has.
     */
    <section
      className="fs-sec pc-quality"
      id="quality"
      data-surface="light"
      data-named={quality.namedProcess ? "true" : "false"}
    >
      <div className="fs-wrap">
        <header className="pc-quality-head reveal-fade-rise">
          <div>
            <p className="fs-eyebrow">
              {quality.namedProcess ? "Processing & quality" : "Quality & testing"}
            </p>
            <h2 className="fs-d2">{quality.heading}</h2>
          </div>
          <p className="fs-lead">{quality.intro}</p>
        </header>

        <div className="pc-quality-grid">
          <ol className="pc-stages reveal-stagger">
            {quality.stages.map((stage, i) => (
              <li className="pc-stage" key={stage.id}>
                <span className="pc-stage-num">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h3 className="pc-stage-name">{stage.name}</h3>
                  <p className="pc-stage-note">{stage.summary}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="pc-quality-side">
            {quality.namedProcess && (
              <div className="pc-named reveal-fade-rise">
                <p className="fs-eyebrow">Named process</p>
                <p className="pc-named-name">{quality.namedProcess.name}</p>
                <p className="pc-named-note">{quality.namedProcess.note}</p>
              </div>
            )}

            <div className="pc-tests reveal-fade-rise">
              <p className="pc-tests-head">
                <span>Batch qualification</span>
                <span>{String(quality.tests.length).padStart(2, "0")}</span>
              </p>

              {/* Property names only. Methods are optional and unset — no approved document in
                  this project names a test standard, so none is printed against one. */}
              <ul className="pc-test-list">
                {quality.tests.map((test) => (
                  <li key={test.property}>
                    <span>{test.property}</span>
                    {test.method && <b>{test.method}</b>}
                  </li>
                ))}
              </ul>

              <p className="pc-tests-foot">
                {quality.footnote}{" "}
                <a href={actionHref(locale, quality.footnoteLink.route)}>
                  {quality.footnoteLink.label}
                  <Arrow size={13} />
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
