import type { ReactNode } from "react";

import { Arrow } from "@/features/site/logo-mark";

import { ANCHORS, FAMILIES, MEDIA, WHO_WE_ARE, WITHHELD } from "../about-data";

import { MediaFrame } from "./hero";

/**
 * 2 · Who We Are — SITE_STRUCTURE §2's second row.
 *
 * ── Six sub-topics specified, three publishable ─────────────────────────────
 *
 * That row expands this section into six: what the company does, where it operates, core
 * categories, customers, direct-producer positioning, and long-term B2B partnership focus. It
 * supplies finished copy for none of them, and marks the operating-markets list — Africa,
 * neighbouring markets, India, Turkiye, Middle East, Asia, Europe — `[ESTIMATE — CONFIRM]`.
 *
 * So three are published: direct producer, production in Iran, six product families. **No market,
 * region, country or customer appears in this section**, because the only document that lists them
 * marks the list as an estimate, and CLAUDE.md §4 does not allow an estimate onto a page.
 *
 * ── The six families are read, not typed ────────────────────────────────────
 *
 * From `PRODUCT_CATEGORIES` via `about-data.ts`. The header, the Products landing and all six
 * category pages read the same constant, so this section cannot drift from them — and a hardcoded
 * list of six is the pattern PROJECT_HANDOFF §6.7 rules out.
 *
 * ── The pending aside ───────────────────────────────────────────────────────
 *
 * Three specified sections are not on this page. The aside names them for the reason the
 * Customized Solutions introduction names its own three: a design proof that quietly omits a
 * timeline, an advantages grid and a team invites the reviewer to conclude the page is finished
 * and short, when it is unfinished and waiting on content. It is proof-state furniture and is
 * deleted when the copy arrives.
 */
export function AboutWhoWeAre(): ReactNode {
  return (
    <section className="fs-sec ab-who" id={ANCHORS.whoWeAre} data-surface="light">
      <div className="fs-wrap ab-who-grid">
        <header className="ab-who-head reveal-fade-rise">
          <p className="fs-eyebrow">Who we are</p>
          <h2 className="fs-d2">{WHO_WE_ARE.heading}</h2>
        </header>

        <div className="ab-who-body reveal-fade-rise">
          {WHO_WE_ARE.body.map((paragraph) => (
            <p className="fs-lead" key={paragraph.slice(0, 40)}>
              {paragraph}
            </p>
          ))}

          <dl className="ab-positions">
            {WHO_WE_ARE.positions.map((position) => (
              <div className="ab-position" key={position.id}>
                <dt>{position.term}</dt>
                <dd>{position.note}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="ab-who-aside">
          <MediaFrame slot={MEDIA.whoWeAre} className="reveal-fade-rise" />

          <nav className="ab-families reveal-fade-rise" aria-labelledby="ab-families-title">
            <p className="ab-families-head" id="ab-families-title">
              <span>The published range</span>
              <span className="fs-tnum">{String(FAMILIES.length).padStart(2, "0")}</span>
            </p>

            <ul>
              {FAMILIES.map((family) => (
                <li key={family.href}>
                  <a href={family.href}>
                    <span>{family.label}</span>
                    <Arrow size={13} />
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <aside className="ab-pending reveal-fade-rise">
          <p className="ab-pending-head">
            <span aria-hidden="true">◇</span>
            <span>
              <strong>Three specified sections are not on this page yet.</strong> They are withheld
              rather than filled with placeholder content.
            </span>
          </p>

          <ul className="ab-pending-list">
            {WITHHELD.map((section) => (
              <li key={section.id}>
                <b>{section.name}</b>
                <span>{section.why}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </section>
  );
}
