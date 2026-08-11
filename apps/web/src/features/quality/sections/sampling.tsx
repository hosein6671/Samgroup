import type { ReactNode } from "react";

import { Arrow } from "@/features/site/logo-mark";

import { ANCHORS, SAMPLING, SAMPLING_FAMILIES } from "../quality-data";

/**
 * 6 · Sampling Policy — SITE_STRUCTURE §7's "confirms: samples issued at first stage for base oil
 * and engine oil, before commitment".
 *
 * ── The composition follows the evidence ────────────────────────────────────
 *
 * This is the strongest confirmed content on the page and it is set largest for that reason. The
 * source states it three times independently — §1's custom-formulation note, §4's engine oils row,
 * and §7's Sampling Policy — and it is the one item in this area marked as confirmed rather than
 * as an estimate. Everything above it on this page is hedged, withheld or definitional; this
 * sentence is not, so the type scale says so.
 *
 * ── The statement is the heading ────────────────────────────────────────────
 *
 * It is the section's `<h2>`, not a lead paragraph under one. A separate heading sat here briefly
 * and was removed: it had no field in the Payload Global (`samplingPolicyText` is the whole
 * section), and on the page it read as a second label directly beneath the eyebrow, competing with
 * it for the same job. Eyebrow, then the sentence, then its scope — nothing between them.
 *
 * ── The limit is published with the policy ──────────────────────────────────
 *
 * §7 confirms it for two families and does not extend it to the other four. The two are read off
 * the canonical `PRODUCT_CATEGORIES` table rather than retyped, and their names link to their own
 * pages — a reader who wants the policy's scope gets the exact families, not a paraphrase.
 *
 * Stating the limit is the point. "Samples are issued before commitment" with no scope beside it
 * is a broader promise than the documentation makes.
 */
export function QualitySampling(): ReactNode {
  return (
    <section className="fs-sec qc-sampling" id={ANCHORS.sampling} data-surface="light">
      <div className="fs-wrap qc-sampling-inner">
        <header className="qc-sampling-head reveal-fade-rise">
          <p className="fs-eyebrow">{SAMPLING.eyebrow}</p>
          <h2 className="qc-sampling-statement">{SAMPLING.statement}</h2>
        </header>

        <div className="qc-sampling-scope reveal-fade-rise">
          <p className="qc-sampling-label">
            <span>{SAMPLING.familiesLabel}</span>
            <span className="fs-tnum">{String(SAMPLING_FAMILIES.length).padStart(2, "0")}</span>
          </p>

          <ul className="qc-sampling-families">
            {SAMPLING_FAMILIES.map((family) => (
              <li key={family.href}>
                <a href={family.href}>
                  <span>{family.label}</span>
                  <Arrow size={14} />
                </a>
              </li>
            ))}
          </ul>

          <p className="qc-sampling-limit">{SAMPLING.limit}</p>
        </div>
      </div>
    </section>
  );
}
