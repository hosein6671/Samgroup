import type { ReactNode } from "react";

import { ANCHORS, LABORATORY, MEDIA, type MediaSlot } from "../quality-data";

/**
 * 3 · Laboratory Capability — SITE_STRUCTURE §7's in-house test list.
 *
 * ── The register carries names and only names ───────────────────────────────
 *
 * Fourteen properties, in the source's order, with no method beside any of them, no condition, no
 * unit and no value. The category template's specification table already established why: an audit
 * found that no document in this project names a single test standard, and a designation cited
 * wrongly against a real property is a technical error a buyer would specify against.
 *
 * A specification table with fourteen empty value columns was the obvious alternative and is the
 * wrong one here. On a category page an empty cell means "lab data pending" and the table's axis
 * is itself the content; on this page there is no product to have values *for* — the content is
 * the capability, and fourteen columns of dashes would manufacture the appearance of withheld
 * results rather than state a capability.
 *
 * ── What is withheld is listed, not implied ─────────────────────────────────
 *
 * Four attributes are absent from the register, and each is named with its reason directly beneath
 * it. In particular the in-house/outsourced split: §7 marks it `[TO CONFIRM]`, so the page claims
 * neither, and says that it claims neither. A "Laboratory Capability" section that stays silent on
 * that point is read as claiming all fourteen in-house.
 *
 * The dashed treatment is proof-state furniture — it is deleted when the content arrives, the same
 * status `.ab-pending` and `.cs-pending` carry on the two pages before this.
 */
export function QualityLaboratory(): ReactNode {
  return (
    <section className="fs-sec qc-lab" id={ANCHORS.laboratory} data-surface="midnight">
      <div className="fs-blueprint" aria-hidden="true" />

      <div className="fs-wrap qc-lab-inner">
        <div className="qc-lab-top">
          <header className="qc-lab-head reveal-fade-rise">
            <p className="fs-eyebrow">Laboratory capability</p>
            <h2 className="fs-d2">{LABORATORY.heading}</h2>
            <p className="fs-lead">{LABORATORY.lead}</p>
          </header>

          <QualityMediaSlot slot={MEDIA.laboratory} className="qc-lab-media reveal-fade-rise" />
        </div>

        <div className="qc-register reveal-fade-rise">
          <p className="qc-register-head">
            <span>{LABORATORY.registerLabel}</span>
            <span className="fs-tnum">
              {String(LABORATORY.properties.length).padStart(2, "0")} · {LABORATORY.orderNote}
            </span>
          </p>

          <ol className="qc-register-list">
            {LABORATORY.properties.map((property, i) => (
              <li className="qc-property" key={property.id}>
                <span className="qc-property-num fs-tnum">{String(i + 1).padStart(2, "0")}</span>
                <span className="qc-property-name">{property.name}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="qc-pending reveal-fade-rise">
          <h3 className="qc-pending-head">
            <span aria-hidden="true">◇</span>
            {LABORATORY.unpublishedHeading}
          </h3>

          <ul className="qc-pending-list">
            {LABORATORY.unpublished.map((item) => (
              <li key={item.id}>
                <b>{item.name}</b>
                <span>{item.why}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/**
 * The page's media slot: a frame reserved for an asset that does not exist yet.
 *
 * ── Why it is drawn rather than left blank ──────────────────────────────────
 *
 * SITE_STRUCTURE's Outstanding Confirmations lists laboratory photography as a launch blocker, and
 * `PAYLOAD_CONTENT_ARCHITECTURE.md` names "lab/testing photography" as this Global's media. An
 * empty box would say the layout is unfinished. This says the *asset* is unfinished, and states
 * what has been commissioned: the intent, the caption the finished asset carries, and the alt text
 * it will inherit.
 *
 * **Nothing here is an image.** No photograph, no illustration of a laboratory, no generated or
 * stock imagery — the project has none of those, and inventing one would be inventing a facility.
 * What is drawn is drafting-table furniture: a hairline frame, a fine blueprint field, gold
 * registration marks at two opposite corners, and the pending state as real text rather than as a
 * visual cue only.
 *
 * ── A knowing second copy ───────────────────────────────────────────────────
 *
 * This is the same construction as `MediaFrame` in `about/sections/hero.tsx`, restated under a
 * `qc-` name. That component's classes are declared in `about.css`, and importing it would pull
 * 831 lines of another page's layout for one frame — the trade `about.css` already documents for
 * `.ab-pending` vs `.cs-pending`, and one this task's scope rules out directly ("no shared CSS
 * refactor").
 *
 * **At two copies this stops being a cheap duplicate.** Promoting the media-slot vocabulary to the
 * design system is now worth its own task, and is recorded here rather than done quietly inside a
 * page build.
 *
 * ── Accessibility ───────────────────────────────────────────────────────────
 *
 * `<figure>`/`<figcaption>`, because that is what this is. The registration marks and the grid are
 * `aria-hidden`; the intent, the pending state and the caption are real text, so a screen reader
 * is told the frame is empty and what it is for instead of being told nothing. `alt` is carried in
 * the data and applied to nothing — there is no `<img>` yet — and it is shown as part of the
 * commission, which is the audience this page has today.
 */
function QualityMediaSlot({
  slot,
  className,
}: {
  readonly slot: MediaSlot;
  readonly className?: string;
}): ReactNode {
  return (
    <figure className={className ? `qc-slot ${className}` : "qc-slot"}>
      <div className="qc-slot-frame">
        <div className="qc-slot-grid" aria-hidden="true" />

        <p className="qc-slot-intent">{slot.intent}</p>

        <p className="qc-slot-state">
          <span className="qc-slot-dot" aria-hidden="true" />
          {slot.pending ? "Image pending" : "Image attached"}
        </p>
      </div>

      <figcaption className="qc-slot-caption">
        <span className="qc-slot-cap">{slot.caption}</span>
        <span className="qc-slot-alt">
          <b>Alt</b>
          {slot.alt}
        </span>
      </figcaption>
    </figure>
  );
}
