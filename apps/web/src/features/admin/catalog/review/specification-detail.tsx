import {
  ApprovalBlockers,
  EvidencePanel,
  Field,
  Fields,
  Panel,
  ProductContext,
  ReviewHistory,
  ReviewInvalidations,
  ReviewWarnings,
  SubPanel,
  SubjectStatus,
} from "./detail-shell";
import {
  MAPPING_CONFIDENCE_LABEL,
  MAPPING_MEANING,
  MAPPING_RESOLVES_LABEL,
  METHOD_REQUIREMENT_LABEL,
  METHOD_REQUIREMENT_MEANING,
  RESULT_BASIS_LABEL,
  STATUS_LABEL,
  VALUE_AXIS_DISCREPANCY,
  VALUE_KIND_LABEL,
  VALUE_KIND_MEANING,
  VALUE_TYPE_LABEL,
} from "./review-vocabulary";
import { ReviewDecisionControl } from "./decision-control";

import type {
  ReviewDetailResponse,
  ReviewMappingRef,
  ReviewMethodRequirement,
  ReviewValueKind,
} from "@sam-group/types";
import type { ReactNode } from "react";

/**
 * The Specification-specific half of the review detail screen.
 *
 * The frame, the product context, the status, the blockers, the evidence and the history all come
 * from `detail-shell.tsx` and are shared with the ProductClaim screen. What is written here is the
 * one thing that differs: the technical value under review, how it was normalized, and the property
 * mapping that decides whether it resolves to the controlled dictionary at all.
 *
 * ## Raw and normalized are two panels, not two columns
 *
 * The single most important thing this screen does is keep "what the document said" apart from
 * "what the platform stored". They are:
 *
 *  * **separate panels**, each with its own heading, so the distinction survives being read
 *    linearly by a screen reader and survives the panels stacking on a phone;
 *  * **separately labelled at field level** — "Raw value (verbatim from the source)" against
 *    "Normalized display value" — so a field read out of context still says which side it is on;
 *  * **never distinguished by colour alone**, and never by position alone.
 *
 * The raw side lives in the evidence panel, next to the document that stated it, because a raw
 * value without its document is not evidence. This module's "Reviewed technical value" panel is the
 * normalized side, and it says so in its own words rather than relying on the reader inferring it.
 *
 * ## Nothing here interprets, converts or corrects
 *
 * No unit is inferred, no method is guessed, no missing label is filled in, and no ambiguous source
 * unit is silently resolved. Where the API served null, the field says "Not recorded". Where the
 * source's unit was absent or uninterpretable, the evidence panel says so beside the raw value.
 *
 * ## No decision control, of any kind
 *
 * Read-only. No form, no field, no button, no Server Action, and no disabled stand-in for a future
 * one.
 */
export function SpecificationDetail({
  subject,
}: {
  readonly subject: ReviewDetailResponse;
}): ReactNode {
  const value = subject.specification;

  return (
    <div className="ad-detail">
      <div className="ad-review-detail-summary">
        <ProductContext product={subject.product} grade={subject.grade} />
        <SubjectStatus subject={subject} />
      </div>

      {value === null ? (
        /*
         * The API populates exactly one of `specification`/`claim`, matching `subjectType`, so this
         * branch is a contract violation rather than a normal state. It is rendered as a stated
         * absence rather than as an empty panel: a page of blank fields would look like a subject
         * with no value, which is a different and wrong thing to tell a reviewer.
         */
        <Panel heading="Reviewed technical value">
          <p className="ad-note ad-note--strong">
            This subject arrived without its technical value. Nothing about the value can be shown,
            and nothing should be concluded from its absence here.
          </p>
        </Panel>
      ) : (
        <>
          <Panel heading="Reviewed technical value">
            <p className="ad-note">
              The normalized value as this platform stored it. The verbatim source reading it was
              derived from is in the evidence panel below.
            </p>
            <Fields>
              <Field label="Property key" value={value.propertyKey} technical />
              <Field label="Normalized display value" value={value.displayValue} technical />
              <Field label="Normalized unit" value={value.unit} technical />
              <Field label="Test method" value={value.method} technical />
              <Field label="Qualifier" value={value.qualifier} technical />
              <Field
                label="Result basis"
                value={RESULT_BASIS_LABEL[value.resultBasis] ?? value.resultBasis}
              />
            </Fields>
          </Panel>

          <Panel heading="Normalized representation">
            <p className="ad-note">
              How the stored value is shaped. The value type decides which numeric columns carry
              meaning; the others are empty by construction, not by omission.
            </p>

            <PropertyDictionary
              valueKind={value.valueKind}
              methodRequirement={value.methodRequirement}
              method={value.method}
            />

            <SubPanel
              heading="Value shape"
              note="The shape of the recorded value, not the kind of quantity the property is."
            >
              <Fields>
                <Field
                  label="Recorded value shape"
                  value={
                    value.valueType === null
                      ? null
                      : (VALUE_TYPE_LABEL[value.valueType] ?? value.valueType)
                  }
                  hint="What this one recorded value is. It is not the property's value kind above."
                />
              </Fields>
              {value.valueKind === "numeric" &&
              (value.valueType === "text" || value.valueType === "report_only") ? (
                <p className="ad-note">{VALUE_AXIS_DISCREPANCY}</p>
              ) : null}
            </SubPanel>

            <SubPanel
              heading="Numeric payload"
              note="Served as text, never as a number: the stored precision does not survive a JavaScript double."
            >
              <Fields>
                <Field label="Numeric minimum" value={value.numericMin} technical />
                <Field label="Numeric maximum" value={value.numericMax} technical />
                <Field label="Pair, first value" value={value.pairFirst} technical />
                <Field label="Pair, second value" value={value.pairSecond} technical />
              </Fields>
            </SubPanel>
          </Panel>

          <PropertyMapping mappings={subject.mappings} propertyKey={value.propertyKey} />
        </>
      )}

      <EvidencePanel evidence={subject.evidence} />
      <ApprovalBlockers blockers={subject.approvalBlockers} />
      <ReviewWarnings warnings={subject.warnings} />
      <Panel heading="Record a decision" className="ad-review-decision-panel">
        <p className="ad-note">
          Decisions are permanent audit events. Approval is available only when every mechanical
          eligibility rule above passes; rejection and return-to-review remain available.
        </p>
        <ReviewDecisionControl
          subjectType={subject.subjectType}
          id={subject.id}
          reviewStatus={subject.reviewStatus}
          evidenceSetHash={subject.evidenceSetHash}
          eligibleForApproval={subject.eligibleForApproval}
        />
      </Panel>
      <ReviewHistory history={subject.history} />
      <ReviewInvalidations invalidations={subject.invalidations} />
    </div>
  );
}

/**
 * The controlled dictionary's two statements about this property.
 *
 * ## Two axes, displayed independently — this is the whole point of the sub-panel
 *
 * `valueKind` is what the PROPERTY carries (numeric, textual, coded). `valueType`, one sub-panel
 * below, is the shape of the ONE value recorded here (point, range, minimum…). Viscosity is a
 * numeric property that legitimately arrives as any of three shapes, so the two are not a
 * consistency check on each other and neither is derived from the other.
 *
 * They are therefore rendered:
 *
 *  * **in separate sub-panels**, each with its own `<h3>`, so a linear read never puts one under
 *    the other's heading;
 *  * **under names that say which axis they are** — "Property value kind" against "Recorded value
 *    shape" — because "Value kind" and "Value type" next to each other are two words for the same
 *    thing to anyone who has not read the schema;
 *  * **without any conversion**. Nothing here maps `numeric` onto `point`, fills a missing kind
 *    from the shape, or hides one because the other is absent.
 *
 * Where the API served null — the property key resolves to no dictionary entry — the field says
 * "Not recorded". It is never guessed, and it is never rendered as `required`.
 *
 * ## The kind/shape discrepancy is informational, and says so
 *
 * A numeric property whose value was stored in a textual shape is worth a reviewer's eye. It is
 * NOT a blocker and NOT a warning in this gate — no rule about the combination has been ratified —
 * so it appears as a plain note next to the two fields it is about, in neither issue list.
 *
 * ## Why the recorded method is repeated here
 *
 * It is already shown, verbatim, in the reviewed-value panel. It appears again beside the
 * requirement because the requirement is unreadable without it: "Required" means nothing until you
 * can see, in the same glance, whether one is recorded. The value shown is the same field, never a
 * second interpretation of it.
 */
function PropertyDictionary({
  valueKind,
  methodRequirement,
  method,
}: {
  readonly valueKind: ReviewValueKind | null;
  readonly methodRequirement: ReviewMethodRequirement | null;
  readonly method: string | null;
}): ReactNode {
  return (
    <SubPanel heading="Controlled dictionary" note={VALUE_KIND_MEANING}>
      <Fields>
        <Field
          label="Property value kind"
          value={valueKind === null ? null : (VALUE_KIND_LABEL[valueKind] ?? valueKind)}
          hint="What the dictionary says this property measures. It is not the recorded value's shape."
        />
        <Field
          label="Test method requirement"
          value={
            methodRequirement === null
              ? null
              : (METHOD_REQUIREMENT_LABEL[methodRequirement] ?? methodRequirement)
          }
          hint={
            methodRequirement === null ? undefined : METHOD_REQUIREMENT_MEANING[methodRequirement]
          }
        />
        <Field label="Test method recorded here" value={method} technical />
      </Fields>
    </SubPanel>
  );
}

/**
 * How the source's own property label reaches the controlled dictionary.
 *
 * This is the durable half of the importer's findings — the half that survives as rows. The
 * manifest's flag list is a generated file, not a fact about this row, and is deliberately not
 * pretended at here.
 *
 * Two statuses sit side by side in this panel and are easy to confuse, so both are labelled in
 * full: **the mapping's own review status** is not the subject's. A mapping at `source_recorded`
 * can still resolve a property (it is HIGH confidence into a seeded key); a mapping a human
 * rejected or superseded resolves nothing, whatever its confidence says.
 *
 * `resolvesSubjectProperty` is the API's verdict, not this component's. Nothing here recomputes it.
 */
function PropertyMapping({
  mappings,
  propertyKey,
}: {
  readonly mappings: readonly ReviewMappingRef[];
  readonly propertyKey: string | null;
}): ReactNode {
  const resolved = mappings.some((mapping) => mapping.resolvesSubjectProperty);

  return (
    <Panel heading="Property mapping">
      <p className="ad-note">{MAPPING_MEANING}</p>

      {mappings.length === 0 ? (
        <p className="ad-note ad-note--strong">
          No mapping is recorded for the source property behind this specification, so the property
          key it carries is not resolved by one.
        </p>
      ) : (
        <>
          <p className="ad-note ad-note--strong">
            {resolved
              ? MAPPING_RESOLVES_LABEL.yes
              : `${MAPPING_RESOLVES_LABEL.no}${propertyKey === null ? "" : ` (${propertyKey})`}`}
          </p>
          <ol className="ad-evidence-list">
            {mappings.map((mapping) => (
              <li
                className="ad-evidence-item"
                key={`${mapping.rawProperty}:${mapping.rawUnit ?? ""}`}
              >
                <h3 className="ad-evidence-title">Mapping</h3>
                <Fields>
                  <Field label="Source property" value={mapping.rawProperty} technical />
                  <Field label="Source unit" value={mapping.rawUnit} technical />
                  <Field label="Maps to property key" value={mapping.specPropertyKey} technical />
                  <Field
                    label="Mapping confidence"
                    value={MAPPING_CONFIDENCE_LABEL[mapping.confidence] ?? mapping.confidence}
                  />
                  <Field
                    label="Mapping review status"
                    value={STATUS_LABEL[mapping.reviewStatus] ?? mapping.reviewStatus}
                    hint="The mapping's own status. It is not this specification's review status."
                  />
                  <Field
                    label="Resolves this specification"
                    value={
                      mapping.resolvesSubjectProperty
                        ? MAPPING_RESOLVES_LABEL.yes
                        : MAPPING_RESOLVES_LABEL.no
                    }
                  />
                  <Field label="Mapping note" value={mapping.note} />
                </Fields>
              </li>
            ))}
          </ol>
        </>
      )}
    </Panel>
  );
}
