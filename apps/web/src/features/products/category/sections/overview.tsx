import type { ReactNode } from "react";

import type { SectionProps } from "../category-section";

/**
 * 2 · Overview — SITE_STRUCTURE §4 item 2.
 *
 * ── A deliberate narrowing, reported rather than resolved silently ──────────
 *
 * §4 item 2 asks this section for "positioning as producer, not reseller". SITE_STRUCTURE's own
 * Outstanding Confirmations block lists, as an open launch blocker, "In-house vs. partner-refinery
 * labeling — which base oil groups Sam Group produces itself vs. sources externally".
 *
 * Both cannot be honoured. CLAUDE.md §4 is unambiguous about which wins — an unconfirmed fact is
 * never seeded into a page — so this section is written about how the range is organised and
 * documented, and makes no claim about where any group is refined. When the labelling is
 * confirmed, the copy in the fixture changes and this component does not.
 *
 * ── The marker rail ─────────────────────────────────────────────────────────
 *
 * Four markers, and not one of them is a business statistic. They state facts about the page:
 * how many sub-ranges it publishes, which classification system it organises them by, which
 * documents are issued, and when a sample is available. The homepage fills a slot like this with
 * live telemetry; this page has no figure it is entitled to print, so it prints none.
 */
export function CategoryOverview({ content }: SectionProps): ReactNode {
  const { overview } = content;

  return (
    <section className="fs-sec pc-over" id="overview" data-surface="light">
      <div className="fs-wrap pc-over-grid">
        <div className="pc-over-copy reveal-fade-rise">
          <p className="fs-eyebrow">Overview</p>
          <h2 className="fs-d2">{overview.heading}</h2>

          {overview.body.map((paragraph) => (
            <p className="fs-lead pc-over-para" key={paragraph.slice(0, 32)}>
              {paragraph}
            </p>
          ))}
        </div>

        <dl className="pc-markers reveal-stagger">
          {overview.markers.map((marker) => (
            <div className="pc-marker" key={marker.label}>
              <dt>{marker.label}</dt>
              <dd>{marker.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
