import type { ReactNode } from "react";

import { INTRODUCTION } from "../solutions-data";

/**
 * 2 · Introduction — SITE_STRUCTURE §5's second section, Payload's `introText`.
 *
 * Two paragraphs and nothing else. The copy is restrained for the reason `solutions-data.ts`
 * gives at length: no approved marketing copy exists for this page, so the introduction states
 * what the route is and the order it happens in, and makes no claim about scale, capability,
 * markets or terms.
 *
 * ── The aside is about the page, not about the business ─────────────────────
 *
 * Three of this page's seven specified sections are not built, because their copy is not written
 * or is explicitly marked as placeholder at source. The aside names them.
 *
 * That is the same principle as the request form's "Not connected" notice: state the gap where a
 * reader would otherwise assume completeness. A design proof that quietly omits three sections
 * invites the reviewer to conclude the page is finished and short, when it is unfinished and
 * waiting on content. Naming them turns the omission into a content request.
 *
 * **It is proof-state furniture and should not lift.** When the three sections have approved copy
 * they render here and this aside is deleted — it is not a permanent design element.
 */
export function SolutionsIntroduction(): ReactNode {
  return (
    <section className="fs-sec cs-intro" data-surface="light">
      <div className="fs-wrap cs-intro-grid">
        <header className="cs-intro-head reveal-fade-rise">
          <p className="fs-eyebrow">Introduction</p>
          <h2 className="fs-d2">{INTRODUCTION.heading}</h2>
        </header>

        <div className="cs-intro-body reveal-fade-rise">
          {INTRODUCTION.body.map((paragraph) => (
            <p className="fs-lead" key={paragraph.slice(0, 40)}>
              {paragraph}
            </p>
          ))}

          <aside className="cs-pending">
            <p className="cs-pending-head">
              <span aria-hidden="true">◇</span>
              <span>
                <strong>Three sections are not on this page yet.</strong> They are specified, and
                they are withheld rather than filled with placeholder copy.
              </span>
            </p>

            <ul className="cs-pending-list">
              <li>
                <b>What Can We Customize?</b>
                <span>Five entries specified; none is named in any approved document.</span>
              </li>
              <li>
                <b>Private Label Programme</b>
                <span>
                  What each side provides is specified as two lists; neither is written, and the
                  minimum order quantity is unconfirmed.
                </span>
              </li>
              <li>
                <b>Case Examples</b>
                <span>
                  Three anonymized summaries, marked at source as placeholders pending real,
                  customer-approved cases.
                </span>
              </li>
            </ul>
          </aside>
        </div>
      </div>
    </section>
  );
}
