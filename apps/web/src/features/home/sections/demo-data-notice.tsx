import type { ReactNode } from "react";

/**
 * The homepage's placeholder-data notice.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 *
 * Almost every figure on this page is the approved prototype's, not audited company data:
 * blending capacity, countries served, years of manufacturing, formulation counts, production
 * lines, lab instruments, test volumes, engineer counts, distributor counts, on-time percentages,
 * first-pass yield, shipping lane durations. SITE_STRUCTURE's Outstanding Confirmations lists
 * "Real figures — Home page trust-indicator statistics" as an open launch item, and CLAUDE.md §4
 * forbids seeding an unverified commercial fact into a page as though it were one.
 *
 * `home-data.ts` has always said so **in a comment**, and its comment claimed the page "carries a
 * visible provisional note". It did not — there was no such note anywhere in the rendered output,
 * which meant the caveat existed only for people reading the source and not for anyone reading the
 * page. This is that note, actually rendered.
 *
 * ── Why it is here rather than beside each figure ───────────────────────────
 *
 * It is rendered **first inside `<main>`, above the hero**, so it precedes every metric on the
 * page rather than trailing some of them. One statement covering the page is also the honest
 * shape of the problem: the figures are not individually suspect, they are collectively
 * provisional.
 *
 * ── This is a stopgap, and should not survive ───────────────────────────────
 *
 * The correct end state is real figures or no figures — not a permanent disclaimer. This banner
 * exists so the page is not silently asserting a fabricated company while the platform waits for
 * approved data, and it is deleted by the gate that supplies that data (or that removes the
 * metrics). It occupies the structural slot the certification marquee used to fill; that marquee
 * published ten unverified standards and was removed outright rather than annotated, because
 * SITE_STRUCTURE §7 forbids publishing a placeholder certification under any framing.
 *
 * A Server Component. No state, no JavaScript.
 */
export function DemoDataNotice(): ReactNode {
  return (
    <aside
      className="fs-demo-note"
      data-surface="midnight"
      aria-label="About the figures on this page"
    >
      <div className="fs-wrap fs-demo-note-inner">
        <span className="fs-demo-tag">Prototype figures</span>
        <p>
          Figures and technical values shown in interactive diagrams are{" "}
          <strong>illustrative prototype data</strong>, not audited company information. Confirmed
          commercial and technical values will replace them before launch.
        </p>
      </div>
    </aside>
  );
}
