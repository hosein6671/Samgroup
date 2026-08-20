import { Arrow } from "@/features/site/logo-mark";
import { productFamilyByKey } from "@/features/site/site-routes";

import { ANCHORS } from "../quality-anchors";

import type { ProductFamilyEntry } from "@/features/site/site-routes";
import type { QualitySampling } from "@sam-group/types";
import type { ReactNode } from "react";

/**
 * 6 · Sampling Policy — SITE_STRUCTURE §7's "samples issued at first stage for base oil and engine
 * oil, before commitment".
 *
 * ── The composition follows the evidence ────────────────────────────────────
 *
 * This is the strongest confirmed content on the page and it is set largest for that reason. The
 * source states it three times independently — §1's custom-formulation note, §4's engine oils row,
 * and §7's Sampling Policy — and it is the one item in this area marked as confirmed rather than as
 * an estimate. Everything above it on this page is hedged, withheld or definitional; this sentence
 * is not, so the type scale says so.
 *
 * ── The statement is the heading ────────────────────────────────────────────
 *
 * It is the section's `<h2>`, not a lead paragraph under one, and the Payload group models no
 * separate heading field — `statement` is the section. It is also the one required field on that
 * group: a sampling section without it is a label and a list of families with nothing said about
 * them.
 *
 * ── The scope is CMS-held, the families are not ─────────────────────────────
 *
 * The CMS holds **which** families the policy covers, as ADR-009 identifiers and nothing more. Each
 * family's published name and page address come from `PRODUCT_CATEGORIES` here in code, backed by
 * `Category` rows in `sam_platform` — Payload may never mirror a Prisma-owned entity (ADR-002), and
 * a CMS text field holding "/products/base-oils" would be a URL an edit could break.
 *
 * A key this table cannot resolve is dropped rather than guessed at. The API already rejects
 * anything outside the frozen six, so this is the second of two guards.
 *
 * ── The section is not rendered when the scope is empty ─────────────────────
 *
 * "A sample is issued before commitment" published with no scope beside it is a broader promise than
 * the documentation makes. The CMS refuses an empty selection at save time, the API declines to
 * serve a sampling section whose keys all failed the allow-list, and this returns `null` if the last
 * key still fails to resolve here. Three guards, because the failure they prevent is a commercial
 * claim the company has not made.
 */
export function QualitySamplingSection({
  sampling,
  locale,
}: {
  readonly sampling: QualitySampling;
  readonly locale: string;
}): ReactNode {
  const { eyebrow, statement, familiesLabel, families, limit } = sampling;

  const resolved = families
    .map((key) => productFamilyByKey(key))
    .filter((family): family is ProductFamilyEntry => family !== undefined);

  if (resolved.length === 0) {
    return null;
  }

  return (
    <section className="fs-sec qc-sampling" id={ANCHORS.sampling} data-surface="light">
      <div className="fs-wrap qc-sampling-inner">
        <header className="qc-sampling-head reveal-fade-rise">
          {eyebrow !== null && <p className="fs-eyebrow">{eyebrow}</p>}
          <h2 className="qc-sampling-statement">{statement}</h2>
        </header>

        <div className="qc-sampling-scope reveal-fade-rise">
          {familiesLabel !== null && (
            <p className="qc-sampling-label">
              <span>{familiesLabel}</span>
              <span className="fs-tnum">{String(resolved.length).padStart(2, "0")}</span>
            </p>
          )}

          <ul className="qc-sampling-families">
            {resolved.map((family) => (
              <li key={family.key}>
                {/*
                  The link's accessible name is the family's canonical label. The arrow is
                  decorative and is hidden from assistive technology, so the name a screen reader
                  announces and the name a reader sees are the same string (WCAG 2.5.3).
                */}
                <a href={`/${locale}${family.href}`}>
                  <span>{family.label}</span>
                  <Arrow size={14} />
                </a>
              </li>
            ))}
          </ul>

          {limit !== null && <p className="qc-sampling-limit">{limit}</p>}
        </div>
      </div>
    </section>
  );
}
