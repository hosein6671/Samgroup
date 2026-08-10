import type { ReactNode } from "react";

import { Arrow } from "@/features/site/logo-mark";

import { FAMILIES } from "../../products-data";
import {
  subRangesOnAxis,
  type DownstreamApplications,
  type SelectionApplications,
} from "../category-contract";
import type { SectionProps } from "../category-section";

/**
 * 6 · Applications — SITE_STRUCTURE §4 item 6.
 *
 * ── How this section avoids inventing a market ──────────────────────────────
 *
 * "Applications" is the easiest section on a product page to fill with invented content: a list
 * of industries and use cases reads as neutral and is almost entirely unverifiable. No document
 * in this project approves one for any category.
 *
 * ── Two honest answers, and the category decides which ──────────────────────
 *
 * The first version assumed every category is an input. Base Oils is: a base stock goes into
 * finished fluids, and the finished fluids this business publishes are its own sibling families,
 * so the section can name real destinations and link to them. That is the `downstream` mode, and
 * it is drawn as a distribution manifold.
 *
 * Antifreeze & Coolants is not. A coolant is a terminal product — nothing else on this site is
 * made from it — so there is no downstream to point at, and the only remaining answers would be
 * an industry list or a use-case list. Both are market coverage, and the market list is an open
 * launch blocker in SITE_STRUCTURE's Outstanding Confirmations. Rendering the manifold anyway
 * would have meant inventing destinations; rendering nothing would have dropped a section the
 * shared template owes every category.
 *
 * So there is a second mode, `selection`. What a terminal category does publish is its own
 * decision structure — the dimensions a buyer resolves, in order — and that is a restatement of
 * the frozen taxonomy rather than a claim about a market. **Its options are not authored**: the
 * component reads them off `range.subRanges` by axis name, so the sequence and the register can
 * never publish different sets.
 *
 * ── The manifold ────────────────────────────────────────────────────────────
 *
 * One source, several destinations. A source node, a trunk running down the branch column, an
 * elbow off the trunk into each destination. Direction is carried by the geometry — the trunk
 * starts at the source and terminates at the last branch — rather than by a decorative arrow.
 *
 * Distinct from the quality rail on the same page by construction: that one runs a *sequence*
 * through three stages, this one *divides* one input into several. Branches carry the
 * destination's own family code rather than an ordinal, because their order carries no meaning.
 * Nothing here is a card — content hangs off a hairline.
 *
 * **Antifreeze & Coolants is deliberately not among Base Oils' destinations.** Coolants are built
 * on glycol, not on a base stock, and listing it to make the set look complete would be a
 * technical error dressed as thoroughness. It is still reachable from the related-category strip.
 *
 * ── The selection sequence ──────────────────────────────────────────────────
 *
 * Drawn as gates rather than as a trunk: the decisions are ordered and each one narrows the last,
 * so they read left to right across the measure with the options under each gate. Numbered,
 * because here the order *does* carry meaning — which is exactly the distinction the manifold's
 * unnumbered branches make in the other direction.
 *
 * ── And a third answer: nothing ─────────────────────────────────────────────
 *
 * Industrial Oils & Lubricants is terminal *and* single-dimension. Its sub-ranges are named for
 * the plant systems they serve — hydraulic, gear, compressor, slideway — so its applications and
 * its range are the same list, and the one reading that would add something (the split between
 * the fluid and grease specification families) is already stated by the property groups.
 *
 * A third mode reprinting the register under a different heading would be filling a slot rather
 * than answering the question the slot asks, so `applications` is optional and that fixture omits
 * it. The whole section does not render. Same handling as `industries`, and reported as a content
 * gap rather than closed with invented copy.
 *
 * ── Section 7, Industries Served, is not rendered ───────────────────────────
 *
 * `content.industries` is optional and no fixture supplies it, for the same reason the selection
 * mode exists. The block below renders only if one ever does.
 */
export function CategoryApplications({ content, family }: SectionProps): ReactNode {
  const { applications, industries } = content;
  if (!applications) return null;

  return (
    <section className="fs-sec pc-apps" id="applications" data-surface="light">
      <div className="fs-wrap">
        <header className="pc-apps-head reveal-fade-rise">
          <div>
            <p className="fs-eyebrow">{applications.eyebrow}</p>
            <h2 className="fs-d2">{applications.heading}</h2>
          </div>
          <p className="fs-lead">{applications.intro}</p>
        </header>

        {applications.mode === "downstream" ? (
          <Manifold applications={applications} family={family} />
        ) : (
          <SelectionSequence applications={applications} content={content} />
        )}

        {industries && industries.length > 0 && (
          <div className="pc-industries reveal-fade-rise">
            <p className="fs-eyebrow">Industries served</p>
            <ul className="pc-industry-list">
              {industries.map((industry) => (
                <li key={industry.id}>
                  <b>{industry.name}</b>
                  <span>{industry.note}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

/** `downstream` — one input, several published destinations. */
function Manifold({
  applications,
  family,
}: {
  readonly applications: DownstreamApplications;
  readonly family: SectionProps["family"];
}): ReactNode {
  return (
    <div className="pc-flow">
      {/*
        The source. It is the category itself, read from the canonical family record rather than
        restated — so the head of the trunk cannot disagree with the page's own heading.
      */}
      <div className="pc-flow-source reveal-fade-rise">
        <p className="fs-eyebrow">Input</p>
        <p className="pc-flow-code">{family.code}</p>
        <p className="pc-flow-name">{family.name}</p>
        <p className="pc-flow-note">
          One input, {applications.entries.length} published destinations.
        </p>
      </div>

      <ol className="pc-flow-branches reveal-stagger">
        {applications.entries.map((entry) => {
          const destination = FAMILIES.find((f) => f.id === entry.familyId);
          if (!destination) return null;

          return (
            <li className="pc-branch" key={entry.familyId}>
              <span className="pc-branch-code" aria-hidden="true">
                {destination.code}
              </span>

              <h3 className="pc-branch-title">
                <a href={destination.href}>
                  {destination.name}
                  <Arrow size={15} />
                </a>
              </h3>

              <p className="pc-branch-note">{entry.note}</p>

              <ul className="pc-branch-fields">
                {entry.fields.map((field) => (
                  <li key={field}>{field}</li>
                ))}
              </ul>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/**
 * `selection` — the ordered decisions inside a terminal category.
 *
 * Gates rather than branches: each decision narrows the last, so they run across the measure and
 * the geometry says "and then", not "and also". They are numbered because here the order carries
 * meaning — the manifold's branches deliberately are not, for the same reason.
 *
 * **No option below is written in this component or in the fixture.** Each gate's list is the
 * sub-ranges the category publishes on that axis, read straight off the range, so a step cannot
 * name something the register does not.
 */
function SelectionSequence({
  applications,
  content,
}: {
  readonly applications: SelectionApplications;
  readonly content: SectionProps["content"];
}): ReactNode {
  return (
    <ol className="pc-gates reveal-stagger">
      {applications.steps.map((step, i) => {
        const options = subRangesOnAxis(content.range, step.axis);

        return (
          <li className="pc-gate" key={step.id}>
            <p className="pc-gate-num">{String(i + 1).padStart(2, "0")}</p>
            <h3 className="pc-gate-axis">{step.axis}</h3>
            <p className="pc-gate-note">{step.note}</p>

            <ul className="pc-gate-options">
              {options.map((option) => (
                <li key={option.id}>
                  <a href={`#range-${option.id}`}>
                    <b>{option.designation}</b>
                    <small>{option.qualifier}</small>
                  </a>
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}
