import type { ReactNode } from "react";

import { ANCHORS, EXPERTISE } from "../about-data";

/**
 * 3 · Our Expertise — SITE_STRUCTURE §2's fourth row.
 *
 * ── Two of six, and no descriptions ─────────────────────────────────────────
 *
 * The row specifies six items and names two of them in passing: "(added Base Oil Processing / thin
 * film polishing, Quality Laboratory)". The remaining four are unnamed. No description exists for
 * any of the six anywhere in `docs/` — SITE_STRUCTURE §4 says as much about Thin Film Polishing
 * from the other direction, naming it twice and describing it nowhere.
 *
 * So this section publishes two names and nothing else. Writing what Thin Film Polishing does, or
 * what the Quality Laboratory is equipped with, would be writing a capability claim here for the
 * first time — the specific failure mode CLAUDE.md §4 and this page's brief both rule out.
 *
 * ── Why there are no placeholder cards ──────────────────────────────────────
 *
 * A six-cell grid with four cells greyed out would present the gap as a layout, and it would fix
 * the count at six in the markup — the thing PROJECT_HANDOFF §6.7 forbids, in a section whose CMS
 * shape is an open-ended repeater. Two entries render; the four are stated once, in a sentence,
 * as a content gap. When they are approved they are two more objects in `about-data.ts` and
 * nothing here changes.
 *
 * ── The device ──────────────────────────────────────────────────────────────
 *
 * A register, not a card grid: each entry is a numbered rule-separated row spanning the measure,
 * with the count of what is specified against the count of what is published stated in the header.
 * Two cards floating in a six-card space would look like a rendering fault. Two rows in a register
 * that says "02 of 06 named" looks like exactly what it is.
 */
export function AboutExpertise(): ReactNode {
  return (
    <section className="fs-sec ab-expertise" id={ANCHORS.expertise} data-surface="midnight">
      <div className="fs-blueprint" aria-hidden="true" />

      <div className="fs-wrap ab-expertise-inner">
        <header className="ab-expertise-head reveal-fade-rise">
          <div>
            <p className="fs-eyebrow">Our expertise</p>
            <h2 className="fs-d2">{EXPERTISE.heading}</h2>
          </div>
          <p className="fs-lead">{EXPERTISE.lead}</p>
        </header>

        <div className="ab-register reveal-fade-rise">
          <p className="ab-register-head">
            <span>Named areas</span>
            <span className="fs-tnum">
              {String(EXPERTISE.items.length).padStart(2, "0")} of{" "}
              {String(EXPERTISE.specifiedCount).padStart(2, "0")}
            </span>
          </p>

          <ol className="ab-register-list">
            {EXPERTISE.items.map((item, i) => (
              <li className="ab-register-row" key={item.id}>
                <span className="ab-register-num fs-tnum">{String(i + 1).padStart(2, "0")}</span>
                <span className="ab-register-name">{item.name}</span>
              </li>
            ))}
          </ol>

          <p className="ab-register-foot">
            {EXPERTISE.specifiedCount - EXPERTISE.items.length} further areas are specified and
            unnamed. They are not rendered as empty cards, and no description is written for the two
            above.
          </p>
        </div>
      </div>
    </section>
  );
}
