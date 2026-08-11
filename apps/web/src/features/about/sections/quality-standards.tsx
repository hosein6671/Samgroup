import type { ReactNode } from "react";

import { Arrow } from "@/features/site/logo-mark";

import { ANCHORS, MEDIA, QUALITY } from "../about-data";

import { MediaFrame } from "./hero";

/**
 * 4 · Quality & Standards — SITE_STRUCTURE §2's `[NEW]` row.
 *
 * ── The four are the source's own four ──────────────────────────────────────
 *
 * "COA-per-batch, TDS/SDS, sample-before-commitment, batch traceability". Nothing is added to
 * them, and only one carries a note: §7's Sampling Policy separately confirms the sample is issued
 * at the first stage of an enquiry, so that one sentence has a second document behind it. The
 * other three are stated as the source states them — elaborating a quality commitment is writing
 * a warranty, and no document here authorises one.
 *
 * ── The certification line is the point of the footnote ─────────────────────
 *
 * §2 marks the actual certifications held `[TO CONFIRM]` and §7 is emphatic that no placeholder
 * certification is ever published. **No certificate, standard number, licence or accreditation
 * appears in this section in any form** — not as a name, not as a logo, not as a greyed-out slot.
 * What appears instead is one sentence saying the list is unconfirmed, because a reader of a
 * quality section who is told nothing will answer the question by assuming.
 *
 * The footnote links to Quality & Certifications, which is where that list lives when it exists.
 * The route 404s today, as every canonical route on every proof page does.
 */
export function AboutQualityStandards(): ReactNode {
  return (
    <section className="fs-sec ab-quality" id={ANCHORS.quality} data-surface="light">
      <div className="fs-wrap ab-quality-grid">
        <header className="ab-quality-head reveal-fade-rise">
          <p className="fs-eyebrow">Quality &amp; standards</p>
          <h2 className="fs-d2">{QUALITY.heading}</h2>
          <p className="fs-lead">{QUALITY.lead}</p>
        </header>

        <div className="ab-quality-body">
          <ul className="ab-commitments reveal-stagger">
            {QUALITY.items.map((item, i) => (
              <li className="ab-commitment" key={item.id}>
                <span className="ab-commitment-num fs-tnum">{String(i + 1).padStart(2, "0")}</span>
                <span className="ab-commitment-body">
                  <b>{item.name}</b>
                  {item.note && <small>{item.note}</small>}
                </span>
              </li>
            ))}
          </ul>

          <p className="ab-quality-foot reveal-fade-rise">
            {QUALITY.footnote}{" "}
            <a href={QUALITY.footnoteLink.href}>
              {QUALITY.footnoteLink.label}
              <Arrow size={13} />
            </a>
          </p>
        </div>

        <MediaFrame slot={MEDIA.quality} className="ab-quality-media reveal-fade-rise" />
      </div>
    </section>
  );
}
