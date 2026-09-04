import {
  AdditivesIcon,
  AutomotiveIcon,
  BaseOilsIcon,
  CoolantsIcon,
  IndustrialIcon,
  MarineIcon,
} from "@/features/site/icons";
import { Arrow } from "@/features/site/logo-mark";
import { PRODUCT_CATEGORIES } from "@/features/site/site-routes";

import { ANCHORS } from "../about-anchors";

import { SectionFigure } from "./hero";

import type { AboutUsWhoWeAre, ProductFamilyKey } from "@sam-group/types";
import type { ReactNode } from "react";

/**
 * A glyph for each of the six families, keyed by the family key — the same `Record<ProductFamilyKey,
 * …>` contract `site-nav.tsx` already established for this exact icon set, so a seventh family added
 * to `PRODUCT_CATEGORIES` without a glyph here is a compile error, not a silently icon-less row.
 * Every glyph is decorative (`aria-hidden`, inherited from `icons.tsx`) — the family name is printed
 * right beside it and says the same thing.
 */
const FAMILY_GLYPHS: Record<ProductFamilyKey, (props: { readonly size: "md" }) => ReactNode> = {
  "base-oils": BaseOilsIcon,
  "lubricant-additives": AdditivesIcon,
  "engine-oils-automotive-lubricants": AutomotiveIcon,
  "industrial-oils-lubricants": IndustrialIcon,
  "marine-oils-lubricants": MarineIcon,
  "antifreeze-coolants": CoolantsIcon,
};

/**
 * Who We Are — the positioning prose, the positioning statements, and the published range.
 *
 * ── The six families are not CMS content ────────────────────────────────────
 *
 * `PRODUCT_CATEGORIES` is the frozen taxonomy in code, backed by `Category` rows in `sam_platform`.
 * Payload must never mirror a Prisma-owned entity (ADR-002, PAYLOAD_CONTENT_ARCHITECTURE §3), so
 * this list stays where the header, the footer and the Products landing already read it from. An
 * editor writes about the range; the range itself is data. The header's family count reads the same
 * list — a derived number, not a second fact someone has to keep in step with the first.
 *
 * ── The body is sanitized HTML ──────────────────────────────────────────────
 *
 * `bodyHtml` arrives allow-list-sanitized from NestJS — the boundary is the API so that every
 * consumer inherits one policy (API_CONTRACT_FINAL §2.4a). Sanitizing again here would add a second
 * policy to keep in step with the first, not a second layer of safety.
 *
 * ── Why the heading is its own full-width row ────────────────────────────────
 *
 * The previous layout gave the heading a narrow column of its own, matched in height by nothing —
 * whatever the prose and the photo beside it ran to, the heading's column stayed just the eyebrow
 * and two lines, leaving a tall empty band under it for as long as the page was reviewed. The heading
 * now sits across the full measure with the family count as its counterweight, and everything below
 * it is two content columns — no column left holding a short heading and nothing under it.
 */
export function AboutWhoWeAre({
  whoWeAre,
  locale,
}: {
  readonly whoWeAre: AboutUsWhoWeAre;
  readonly locale: string;
}): ReactNode {
  const familyCount = PRODUCT_CATEGORIES.length;

  return (
    <section className="fs-sec ab-who" id={ANCHORS.whoWeAre} data-surface="light">
      <div className="fs-wrap">
        {whoWeAre.heading !== null && (
          <header className="ab-who-head reveal-fade-rise">
            <div>
              <p className="fs-eyebrow">Who we are</p>
              <h2 className="fs-d2">{whoWeAre.heading}</h2>
            </div>
            <p className="ab-who-tally">
              <span className="ab-who-tally-num fs-tnum">
                {String(familyCount).padStart(2, "0")}
              </span>
              <span className="ab-who-tally-label">Product families produced directly</span>
            </p>
          </header>
        )}

        <div className="ab-who-columns">
          <div className="ab-who-body reveal-fade-rise">
            {whoWeAre.bodyHtml !== "" && (
              <div
                className="ab-who-prose"
                dangerouslySetInnerHTML={{ __html: whoWeAre.bodyHtml }}
              />
            )}

            {/*
             * The three positioning statements, ruled into columns rather than stacked — the same
             * `.ab-position` divider (a hairline plus an inset measure) that stacked them before,
             * just laid out across the row instead of down it. "What this rests on" only labels the
             * block; it does not count the items, so the wording stays true if a future edit adds or
             * removes one.
             */}
            {whoWeAre.positions.length > 0 && (
              <div className="ab-who-positions-panel">
                <p className="ab-who-positions-label">What this rests on</p>
                <dl className="ab-positions reveal-stagger">
                  {whoWeAre.positions.map((position) => (
                    <div className="ab-position" key={position.term}>
                      <dt>{position.term}</dt>
                      <dd>{position.note}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>

          <div className="ab-who-aside">
            {whoWeAre.figure !== null && (
              <SectionFigure figure={whoWeAre.figure} className="reveal-fade-rise" />
            )}

            <nav className="ab-families reveal-fade-rise" aria-labelledby="ab-families-title">
              <p className="ab-families-head" id="ab-families-title">
                <span>Product families</span>
                <span className="fs-tnum">{String(familyCount).padStart(2, "0")}</span>
              </p>
              <ul>
                {PRODUCT_CATEGORIES.map((family) => {
                  const Glyph = FAMILY_GLYPHS[family.key];

                  return (
                    <li key={family.href}>
                      <a href={`/${locale}${family.href}`}>
                        <span className="ab-families-item">
                          <Glyph size="md" />
                          <span>{family.label}</span>
                        </span>
                        <Arrow size={13} />
                      </a>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>
        </div>
      </div>
    </section>
  );
}
