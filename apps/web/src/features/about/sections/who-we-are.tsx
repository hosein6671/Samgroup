import { Arrow } from "@/features/site/logo-mark";
import { PRODUCT_CATEGORIES } from "@/features/site/site-routes";

import { ANCHORS } from "../about-anchors";

import { SectionFigure } from "./hero";

import type { AboutUsWhoWeAre } from "@sam-group/types";
import type { ReactNode } from "react";

/**
 * Who We Are — the positioning prose, the positioning statements, and the published range.
 *
 * ── The six families are not CMS content ────────────────────────────────────
 *
 * `PRODUCT_CATEGORIES` is the frozen taxonomy in code, backed by `Category` rows in `sam_platform`.
 * Payload must never mirror a Prisma-owned entity (ADR-002, PAYLOAD_CONTENT_ARCHITECTURE §3), so
 * this list stays where the header, the footer and the Products landing already read it from. An
 * editor writes about the range; the range itself is data.
 *
 * ── The body is sanitized HTML ──────────────────────────────────────────────
 *
 * `bodyHtml` arrives allow-list-sanitized from NestJS — the boundary is the API so that every
 * consumer inherits one policy (API_CONTRACT_FINAL §2.4a). Sanitizing again here would add a second
 * policy to keep in step with the first, not a second layer of safety.
 */
export function AboutWhoWeAre({
  whoWeAre,
  locale,
}: {
  readonly whoWeAre: AboutUsWhoWeAre;
  readonly locale: string;
}): ReactNode {
  return (
    <section className="fs-sec ab-who" id={ANCHORS.whoWeAre} data-surface="light">
      <div className="fs-wrap ab-who-grid" data-figure={whoWeAre.figure === null ? "no" : "yes"}>
        {whoWeAre.heading !== null && (
          <header className="ab-who-head reveal-fade-rise">
            <p className="fs-eyebrow">Who we are</p>
            <h2 className="fs-d2">{whoWeAre.heading}</h2>
          </header>
        )}

        <div className="ab-who-body reveal-fade-rise">
          {whoWeAre.bodyHtml !== "" && (
            <div className="ab-who-prose" dangerouslySetInnerHTML={{ __html: whoWeAre.bodyHtml }} />
          )}

          {whoWeAre.positions.length > 0 && (
            <dl className="ab-positions">
              {whoWeAre.positions.map((position) => (
                <div className="ab-position" key={position.term}>
                  <dt>{position.term}</dt>
                  <dd>{position.note}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        <div className="ab-who-aside">
          {whoWeAre.figure !== null && (
            <SectionFigure figure={whoWeAre.figure} className="reveal-fade-rise" />
          )}

          <nav className="ab-families reveal-fade-rise" aria-labelledby="ab-families-title">
            <p className="ab-families-head" id="ab-families-title">
              <span>Product families</span>
              <span className="fs-tnum">{String(PRODUCT_CATEGORIES.length).padStart(2, "0")}</span>
            </p>
            <ul>
              {PRODUCT_CATEGORIES.map((family) => (
                <li key={family.href}>
                  <a href={`/${locale}${family.href}`}>
                    <span>{family.label}</span>
                    <Arrow size={13} />
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </section>
  );
}
