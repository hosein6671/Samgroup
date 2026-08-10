/**
 * Site-level defaults every category shares.
 *
 * ── Why these are not in the fixtures ───────────────────────────────────────
 *
 * Three category fixtures each carried their own copy of the supply formats, the Incoterms and
 * the three quality-control stages. Not one of those is category-level content: the formats and
 * the Incoterms come from SITE_STRUCTURE §6, which describes them for the business rather than
 * for a product line, and the stages come from §7's "Incoming/In-Process/Outgoing testing
 * stages", which is a company-wide statement. Three copies of one fact is three places for it to
 * drift, and the fourth, fifth and sixth categories would have made six.
 *
 * They live here as named constants. A fixture that genuinely needs a different set still
 * declares its own array — nothing here is enforced, and nothing is spread implicitly.
 *
 * ── What is deliberately still per-category ─────────────────────────────────
 *
 * `supply.terms` stays in each fixture. It is one sentence about how minimum quantity and lead
 * time are established, and the variables it names differ by category — Antifreeze quotes against
 * a dilution state, the others do not. It is short enough that centralising it would cost more in
 * indirection than it saves in duplication.
 *
 * The documentation block also stays per-category: TDS/SDS/COA are the same three documents
 * everywhere, but what each describes is worded against that category's own members.
 */

import type { QualityStage, SupplyBlock } from "../category-contract";

/**
 * SITE_STRUCTURE §6's own list: "Bulk/Flexitank/Drums/IBC/Customized" plus "Pails & Retail Packs".
 * Naming the formats the business supplies in is not a claim about volumes.
 */
export const SUPPLY_FORMATS: SupplyBlock["formats"] = [
  "Bulk",
  "Flexitank",
  "Drums",
  "IBC",
  "Pails & retail packs",
  "Customized",
];

/** The four §6 names as the terms the site explains. Standard trade terms, not commitments. */
export const INCOTERMS: SupplyBlock["incoterms"] = ["EXW", "FOB", "CFR", "CIF"];

/**
 * SITE_STRUCTURE §7's three testing stages, verbatim in structure. Company-wide, so every
 * category renders the same three unless one is ever documented differently.
 */
export const QUALITY_STAGES: readonly QualityStage[] = [
  {
    id: "incoming",
    name: "Incoming",
    summary: "Material is tested on arrival, before it enters the process.",
  },
  {
    id: "in-process",
    name: "In-process",
    summary: "Testing runs during processing rather than only at the end of it.",
  },
  {
    id: "outgoing",
    name: "Outgoing",
    summary:
      "The batch is tested again before release, and the result is the Certificate of Analysis issued with it.",
  },
];

/**
 * The line under the quality test list.
 *
 * §7 marks the in-house/partner-laboratory split `[TO CONFIRM]`, so no page states it — each one
 * points at the document that will.
 */
export const QUALITY_FOOTNOTE =
  "Which of these are run in-house and which are run at a partner laboratory is stated on Quality & Certifications, not here.";

/**
 * Shown once per property group whose columns declare no test method.
 *
 * Every fixture is in that state: no approved document in this project names a test standard, so
 * none is printed. This says so plainly instead.
 */
export const METHOD_NOTE = "Test methods for this axis are pending technical review.";

/** Shown above the specification tables. The values themselves are `[ESTIMATE — CONFIRM]` at source. */
export const PENDING_NOTE =
  "Typical values are not published on this page. They are issued in the Technical Data Sheet, which needs no form.";
