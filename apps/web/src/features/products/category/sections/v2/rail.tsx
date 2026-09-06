import type { ReactNode } from "react";

import { Arrow } from "@/features/site/logo-mark";

import { actionHref } from "../../category-contract";
import type { SectionProps } from "../../category-section";

/**
 * v2 · The Catalog Rail — a sticky companion beside the browse-and-select zone.
 *
 * It carries three things a buyer keeps reaching for while choosing: the family's quick facts,
 * the two enquiry actions, and a jump list for the rest of the page. On desktop it is sticky
 * alongside the published-products and classification blocks; on mobile it collapses to the
 * facts strip alone (the actions are already in the hero, and the jump list is redundant once
 * the page is a single scroll).
 *
 * ── The facts are the fixture's own markers ───────────────────────────────
 *
 * `overview.markers` — "7 sub-ranges", "8 designations", "Group + grade", "TDS · SDS · COA".
 * They are structural facts about the page, never commercial figures, and they are shown here
 * rather than in the guidance block so the same four are not printed twice. No live catalogue
 * count: that number is the products block's job (`meta.total`), and it sits behind a Suspense
 * boundary the rail is deliberately outside of.
 *
 * ── The jump list ────────────────────────────────────────────────────────
 *
 * Plain in-page anchors, no scroll-spy — every target id is rendered on this page (the products
 * and classification sections here, the reused sections below the shell). No client JavaScript.
 *
 * A Server Component. No `reveal-*` class.
 */

const JUMP_TARGETS = [
  { href: "#products", label: "Published products" },
  { href: "#classification", label: "Classification" },
  { href: "#specifications", label: "Key specifications" },
  { href: "#applications", label: "Applications & process" },
  { href: "#supply", label: "Packaging & supply" },
  { href: "#documentation", label: "Documentation" },
] as const;

export function CatalogRail({ content, locale }: SectionProps): ReactNode {
  const { overview, hero } = content;

  return (
    <aside className="pcv2-rail" aria-label="Family summary and quick links">
      <div className="pcv2-rail-in">
        <p className="fs-eyebrow">At a glance</p>

        <dl className="pcv2-rail-facts">
          {overview.markers.map((marker) => (
            <div className="pcv2-rail-fact" key={marker.label}>
              <dt>{marker.label}</dt>
              <dd>{marker.value}</dd>
            </div>
          ))}
        </dl>

        <div className="pcv2-rail-acts">
          <a href={actionHref(locale, hero.primary.route)} className="fs-btn fs-btn--gold">
            {hero.primary.label}
            <Arrow size={14} />
          </a>
          <a href={actionHref(locale, hero.secondary.route)} className="fs-btn fs-btn--glass">
            {hero.secondary.label}
          </a>
        </div>

        <nav className="pcv2-rail-jump" aria-label="On this page">
          <p className="pcv2-rail-jump-label">On this page</p>
          <ul>
            {JUMP_TARGETS.map((target) => (
              <li key={target.href}>
                <a href={target.href}>{target.label}</a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </aside>
  );
}
