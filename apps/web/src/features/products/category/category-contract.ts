/**
 * The Product Category page's data contract.
 *
 * ── What this file is ───────────────────────────────────────────────────────
 *
 * One template serves all six frozen categories (SITE_STRUCTURE §4: "every one of the six
 * follows this exact structure"). This module is the seam between that template and its content:
 * every section below takes a shape declared here, and a category is a single object satisfying
 * `ProductCategoryContent`. Adding the remaining five categories is five fixture files and five
 * route files — no new components, no second page architecture.
 *
 * ── Why it is shaped like the API and not like the markup ───────────────────
 *
 * The shapes track `Category` / `Product` / `Specification` from `docs/DATA_MODEL.md` §1, not the
 * DOM. A category page renders every product in its category on one page — there is no
 * `[productSlug]` route (FRONTEND_ARCHITECTURE §1, confirmed by SITE_STRUCTURE §4) — so `Product`
 * rows arrive here as `Grade` entries nested under their sub-range, and `Specification` rows
 * arrive as the `values` lookup in `PropertyMatrix`. When `GET /api/v1/categories/:slug` exists,
 * the fixture module is replaced and the components do not move.
 *
 * ── What is deliberately absent ─────────────────────────────────────────────
 *
 * There is no field anywhere below for a capacity, a tonnage, a lead time, a minimum order, a
 * market list, a customer count, an origin claim or a performance figure. Not "empty" — absent.
 * Those are commercial facts, every one of them sits behind an open confirmation in
 * SITE_STRUCTURE's "Outstanding Confirmations", and CLAUDE.md §4 forbids seeding an unverified
 * one into a page. A field that does not exist cannot be filled in with a plausible guess.
 *
 * ── No standards either, until they are approved ────────────────────────────
 *
 * An earlier revision carried ASTM designations, an API 1509 attribution and an NLGI reference on
 * the property axes. An audit of `docs/` found that **no project document contains any of them** —
 * the documentation names properties ("viscosity, VI, flash/pour point, colour, density, water
 * content, foam, copper corrosion, coolant freeze point/reserve alkalinity, ICP elemental
 * analysis", SITE_STRUCTURE §7) and never the standards that measure them. They were correct as
 * far as general knowledge goes, but they were unapproved content on a product page, and a wrong
 * method number cited against a real property is a technical error a buyer would specify against.
 *
 * They are gone. `PropertyColumn.method` is now optional and every fixture leaves it unset, so the
 * page states that methods are pending technical review rather than naming one. The same applies
 * to test conditions and to any classification-system attribution. When a technical reviewer
 * approves a method list it is filled in per column and the components render it unchanged.
 */

import { ROUTES } from "@/features/site/site-routes";

/* ------------------------------------------------------------------ actions */

/**
 * Destinations a category page is allowed to point at, as ids rather than paths.
 *
 * No fixture holds a URL. The canonical table in `site-routes.ts` is the only place a path is
 * written, so a route change is one edit and six category fixtures cannot drift from it.
 */
export type RouteId =
  "quote" | "sample" | "customization" | "finder" | "quality" | "exportLogistics" | "products";

export const ACTION_HREF: Record<RouteId, string> = {
  quote: ROUTES.requestQuote,
  /*
   * "Request Sample" resolves to Contact Us, not to a sample form. `SampleRequest` was merged
   * into `Inquiry` (`inquiryType: 'Sample Request'` + `relatedProductId`) — there is no separate
   * sample entity or form anywhere on the platform (DATA_MODEL.md §1 notes). Pointing this
   * elsewhere would rebuild the entity that was deliberately removed.
   */
  sample: ROUTES.contactUs,
  customization: ROUTES.customizedSolutions,
  finder: ROUTES.productFinder,
  quality: ROUTES.qualityCertifications,
  exportLogistics: ROUTES.exportLogistics,
  products: ROUTES.products,
};

export type CategoryAction = {
  readonly label: string;
  readonly route: RouteId;
};

/* --------------------------------------------------------------------- hero */

export type CategoryHero = {
  readonly headline: string;
  readonly lead: string;
  /** SITE_STRUCTURE §4 item 1: "primary/secondary CTA (Request a Quote / Request Sample)". */
  readonly primary: CategoryAction;
  readonly secondary: CategoryAction;
};

/* ----------------------------------------------------------------- overview */

/**
 * §4 item 2 — Overview.
 *
 * `markers` is a spec list, not a statistics strip: each entry states something structural about
 * the page itself (how many sub-ranges it publishes, which classification system it uses, which
 * documents are issued). Nothing in it is a commercial figure, and the type has no unit field
 * precisely so that one cannot be smuggled in.
 */
export type CategoryOverview = {
  readonly heading: string;
  readonly body: readonly string[];
  readonly markers: readonly { readonly label: string; readonly value: string }[];
};

/* -------------------------------------------------------------------- range */

/** One product row. `Product.slug` becomes `id`, `Product.name` becomes `designation`. */
export type Grade = {
  readonly id: string;
  readonly designation: string;
  readonly note?: string;
};

/**
 * A sub-range within the category — `Category` is self-referencing via `parentId`
 * (DATA_MODEL.md §1 notes), so a sub-range is a child category and this is that relation.
 *
 * `grades` is empty wherever the frozen taxonomy names the sub-range but no individual grade
 * inside it. That is left empty rather than padded: SITE_STRUCTURE §4 names SN 150/350/500/650
 * under Group I and BS 150 under Bright Stock, and inventing designations for the others to make
 * the rows look even would be inventing products.
 */
export type SubRange = {
  readonly id: string;
  readonly designation: string;
  /**
   * Optional, and unset in every fixture today.
   *
   * It carried each sub-range's place in a classification system — "API 1509 Group I",
   * "Monoethylene glycol", "Enclosed gearing". None of those is in an approved document, so all
   * were removed; the field stays for when a technical reviewer supplies approved wording.
   */
  readonly qualifier?: string;
  readonly summary: string;
  readonly grades: readonly Grade[];
  /**
   * The dimension this sub-range belongs to, where the category is organised by more than one.
   *
   * Base Oils is a single hierarchy — seven sub-ranges of one kind — so it sets no axis and the
   * range renders as a flat register. Antifreeze & Coolants is not: SITE_STRUCTURE §4 organises
   * it "by base fluid (MEG/MPG) and inhibitor technology (IAT/OAT/HOAT/Si-OAT, NAP-free);
   * concentrate or ready-to-use" — three orthogonal dimensions, not one list of eight. Flattening
   * them would present three axes as a single hierarchy, which is a claim about the taxonomy that
   * the source document does not make.
   *
   * Optional, so a single-hierarchy category is unaffected and renders exactly as before.
   */
  readonly axis?: string;
};

export type CategoryRange = {
  readonly heading: string;
  readonly intro: string;
  /**
   * The axes a formal classification system discriminates on — names only.
   *
   * Deliberately no thresholds. The API 1509 group boundaries are public, but a numeric limit
   * printed on a product page reads as a specification of the product rather than of the
   * standard, and this page carries no specification of its products yet.
   *
   * **Optional, because not every category has one.** API 1509 is real and is what orders Base
   * Oils. No approved document gives Antifreeze & Coolants an equivalent formal system, so that
   * fixture omits the field and the strip does not render — rather than the strip being filled
   * with three plausible-sounding criteria, which would invent a standard.
   */
  readonly classificationAxes?: readonly string[];
  readonly subRanges: readonly SubRange[];
};

/* --------------------------------------------------------------- properties */

/**
 * One column of the typical-properties table — a `Specification.key`.
 *
 * `label` must be a property SITE_STRUCTURE §7 already names. `method` and `condition` are
 * optional and unset in every fixture today: naming a test standard or a test condition is
 * technical content, and no approved document in this project carries one. A group whose columns
 * declare no method renders a single line saying methods are pending review, rather than a
 * plausible designation per column.
 */
export type PropertyColumn = {
  readonly key: string;
  readonly label: string;
  readonly unit?: string;
  readonly method?: string;
  readonly condition?: string;
};

/**
 * The words a category uses for its own specification table.
 *
 * These were hardcoded in `properties.tsx` as "Grade", "Classification", "Sub-range" and
 * "Typical properties, by grade" — correct for Base Oils, which is the category the component was
 * written against, and wrong for the two built after it. Antifreeze & Coolants and Industrial Oils
 * & Lubricants publish no grades at all, so every row of their tables read "Grade: MEG base".
 *
 * A shared template must not name one category's vocabulary. It lives here instead.
 */
export type PropertyLabels = {
  /** Heading of the first column — "Grade" for a category that names grades, else its own term. */
  readonly rowHeading: string;
  /** Sub-heading under it — "Designation", "Duty", whatever the category's members are. */
  readonly rowSubHeading: string;
  /** Shown under a row standing for a whole sub-range rather than a named member inside one. */
  readonly rangeRowLabel: string;
  /**
   * Second column, populated from each row's `axis`. Omit both to render no second column —
   * which is the correct result for a category organised as a single hierarchy, since it has no
   * dimension to state.
   */
  readonly groupingHeading?: string;
  readonly groupingSubHeading?: string;
  /** Caption for the table when the category has a single axis. */
  readonly caption: string;
};

/**
 * One specification family: an axis, and the sub-ranges it describes.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 *
 * The first two categories built each described every member on one axis, and the contract said
 * so — a single `columns` array per category. Industrial Oils & Lubricants does not. Eight of its
 * nine sub-ranges are fluids, described by kinematic viscosity, viscosity index, flash and pour
 * point; the ninth is greases, described by consistency, dropping point and the viscosity of the
 * *base oil inside the grease*. There is no honest single axis: half the columns would be blank
 * for one row not because the lab data is pending, but because the property does not apply.
 *
 * A blank that means "pending" and a blank that means "not applicable" must not look alike on a
 * specification sheet. So a category now carries one or more groups, each with its own axis.
 *
 * ── Coverage ────────────────────────────────────────────────────────────────
 *
 * `subRangeIds` names the sub-ranges this axis describes. **At most one group may omit it**, and
 * that group takes every sub-range no other group claimed — so a single-axis category declares
 * one group and no ids at all, and reads exactly as it did before this type existed. Coverage is
 * checked at render by `propertyGroups`, which throws rather than silently dropping a sub-range
 * or listing one twice.
 */
export type PropertyGroup = {
  readonly id: string;
  /** Shown only when a category has more than one group; a single axis needs no label. */
  readonly label: string;
  /** Why this family has an axis of its own. Rendered beside the label, same condition. */
  readonly note?: string;
  readonly columns: readonly PropertyColumn[];
  readonly subRangeIds?: readonly string[];
  /**
   * `Specification` rows in lookup form: row id → property key → value. A key that is absent has
   * no published value — which is currently every key of every row, and the source document says
   * exactly why: the table §4 item 4 specifies is marked `[ESTIMATE — CONFIRM]`, "replace with
   * real lab data". CLAUDE.md §4 forbids seeding a placeholder like that into a page, so the
   * table renders its full axis and an explicit unpublished state in every cell.
   *
   * This is the shape a populated table has, not a stand-in for one: when lab data is approved it
   * is added here and the same component renders it.
   */
  readonly values: Readonly<Record<string, Readonly<Record<string, string>>>>;
};

/** §4 item 4 — Key Specifications. One axis, or several. */
export type PropertyMatrix = {
  readonly heading: string;
  readonly intro: string;
  readonly labels: PropertyLabels;
  readonly groups: readonly PropertyGroup[];
  readonly pendingNote: string;
  /** Shown once per group whose columns declare no method. Provisional, and stated as such. */
  readonly methodNote: string;
};

/* ------------------------------------------------------------------ quality */

/**
 * §4 item 5 — "Processing & Quality (Base Oil only — Thin Film Polishing block) / Quality &
 * Testing (all others)".
 *
 * `namedProcess` is the Base-Oil-only half, and it is optional for exactly that reason. The
 * other five categories omit it and the block renders as Quality & Testing.
 */
export type QualityStage = {
  readonly id: string;
  readonly name: string;
  readonly summary: string;
};

export type QualityBlock = {
  readonly heading: string;
  readonly intro: string;
  readonly namedProcess?: { readonly name: string; readonly note: string };
  readonly stages: readonly QualityStage[];
  /**
   * Properties a batch is qualified against — names only, from SITE_STRUCTURE §7's laboratory
   * list. `method` is optional and unset everywhere, for the same reason as `PropertyColumn`.
   */
  readonly tests: readonly { readonly property: string; readonly method?: string }[];
  readonly footnote: string;
  readonly footnoteLink: CategoryAction;
};

/* ------------------------------------------------------- applications & use */

/**
 * §4 item 6 — Applications.
 *
 * An application is stated as one of the site's **own** frozen product families, never as an
 * invented market or use case. Base oil goes into finished fluids, and the finished fluids this
 * business publishes are the other five entries in `PRODUCT_CATEGORIES` — so the downstream list
 * is already frozen, already named, and already routed. `fields` is checked at module load
 * against that family's own `ranges`, so a hand-typed application cannot creep in.
 */
export type ApplicationEntry = {
  /** A `ProductFamily.id` from `products-data.ts`. */
  readonly familyId: string;
  readonly note: string;
  readonly fields: readonly string[];
};

/**
 * §4 item 6 has two honest shapes, and which one applies is a property of the category rather
 * than a presentation choice.
 *
 * **`downstream`** — the category is an input. Base oil goes into finished fluids, and the
 * finished fluids this business publishes are its own sibling families, so the section can name
 * destinations without inventing anything. Drawn as a distribution manifold.
 *
 * **`selection`** — the category is terminal. A coolant is not a feedstock for anything else on
 * this site, so there is no downstream to point at, and the only remaining honest answers are an
 * industry list or a use-case list. Both are market coverage, and the market list is an open
 * launch blocker. What *is* published is the category's own decision structure: the axes a buyer
 * resolves, in order. That is a restatement of the frozen taxonomy, not a claim about a market.
 *
 * A union rather than an optional field, because a category is one or the other and the compiler
 * should say so. Rendering the manifold for a terminal category is precisely the mistake this
 * type exists to prevent.
 */
export type DownstreamApplications = {
  readonly mode: "downstream";
  readonly eyebrow: string;
  readonly heading: string;
  readonly intro: string;
  readonly entries: readonly ApplicationEntry[];
};

/**
 * One decision in the selection sequence.
 *
 * It names the axis and says what the decision is for. **It does not list the options** — those
 * are read off `range.subRanges` by the axis name, so the sequence and the register can never
 * publish different sets, and a hand-typed option cannot appear here at all.
 */
export type SelectionStep = {
  readonly id: string;
  /** Must match a `SubRange.axis` in this category's range. */
  readonly axis: string;
  readonly note: string;
};

export type SelectionApplications = {
  readonly mode: "selection";
  readonly eyebrow: string;
  readonly heading: string;
  readonly intro: string;
  readonly steps: readonly SelectionStep[];
};

export type ApplicationsBlock = DownstreamApplications | SelectionApplications;

/**
 * §4 item 7 — Industries Served.
 *
 * Optional, and omitted by every fixture today. The industry and market list is an open launch
 * blocker in SITE_STRUCTURE's Outstanding Confirmations ("final confirmed export markets"), and
 * a served-industry list is market coverage. The slot exists so the section is a fixture edit
 * when the list is approved; until then the section does not render at all.
 */
export type IndustryEntry = {
  readonly id: string;
  readonly name: string;
  readonly note: string;
};

/* ------------------------------------------------------------------- supply */

/**
 * §4 item 8 — Packaging & Supply.
 *
 * Formats are the six named on the Export & Logistics structure (SITE_STRUCTURE §6: "Bulk,
 * Flexitank, Drums, IBC, Customized, plus Pails & Retail Packs"). Incoterms are the four that
 * document names as the ones explained.
 *
 * **There is no MOQ field and no lead-time field.** Both are `[TO CONFIRM]` at source. `terms`
 * is one sentence about how they are established, which is a process statement, not a figure.
 */
export type SupplyBlock = {
  readonly heading: string;
  readonly intro: string;
  readonly formats: readonly string[];
  readonly incoterms: readonly string[];
  readonly terms: string;
  readonly link: CategoryAction;
};

/* ------------------------------------------------------------ documentation */

/**
 * §4 item 10 — Documentation.
 *
 * The access split is not SITE_STRUCTURE §3's. That document summarises the block as
 * "TDS/SDS/COA download, gated behind a short qualifying form"; the approved data model is
 * narrower and explicit — gating covers the Company and Product catalogues only, and "TDS and
 * SDS are explicitly not gated" (DATA_MODEL.md §`DOWNLOAD_REQUEST`, DATA_MODEL_GAP_REVIEW.md §5).
 * CLAUDE.md §1 ranks the data model above SITE_STRUCTURE, so `access` exists to carry that split
 * and the frozen Products landing already implements the same resolution.
 */
export type CategoryDocument = {
  readonly code: string;
  readonly label: string;
  readonly scope: string;
  readonly access: "open" | "gated";
};

export type DocumentationBlock = {
  readonly heading: string;
  readonly intro: string;
  readonly documents: readonly CategoryDocument[];
  readonly note: string;
};

/* ---------------------------------------------------------------------- faq */

/**
 * §4 item 11 — FAQ.
 *
 * Every answer in a fixture must be traceable to a frozen document; the fixture records the
 * source beside each one. An invented answer on this page is an invented commercial claim.
 *
 * `FAQPage` structured data is **not** emitted yet. It renders through the shared `<JsonLd>`
 * component specified in FRONTEND_ARCHITECTURE §4, which does not exist — building it here would
 * be adding shared site architecture inside a page task.
 */
export type FaqEntry = {
  readonly id: string;
  readonly question: string;
  readonly answer: string;
  readonly link?: CategoryAction;
};

/* ------------------------------------------------------------------ content */

/**
 * One product category page, whole.
 *
 * Section order matches SITE_STRUCTURE §4's numbering exactly. Item 9 (Customization) and item
 * 12 (Product Page CTA) are not fields here: both are served by the shared closing CTA, whose
 * primary action *is* Request a Custom Solution and which §4/§3 specify as shared across all six
 * category pages and the landing.
 */
export type ProductCategoryContent = {
  /** Matches a `ProductFamily.id` in `products-data.ts` — and `Category.slug` in the API. */
  readonly familyId: string;
  readonly hero: CategoryHero;
  readonly overview: CategoryOverview;
  readonly range: CategoryRange;
  readonly properties: PropertyMatrix;
  readonly quality: QualityBlock;
  /**
   * Optional, and the third category built is the reason.
   *
   * Base Oils is an input, so it has real downstream siblings to name. Antifreeze & Coolants is
   * terminal but organised by three dimensions, so it has a real selection sequence. Industrial
   * Oils & Lubricants is terminal *and* single-dimension: its sub-ranges are named for the plant
   * systems they serve, so the only Applications content available for it is a restatement of
   * its own range — and the one reading that would add something, the split between the fluid and
   * grease specification families, is already stated by the property groups.
   *
   * The honest handling is the same as `industries`: the section does not render. A third mode
   * that reprinted the register under a different heading would be filling a slot, not answering
   * the question the slot asks. Flagged as a content gap rather than closed with invented copy.
   */
  readonly applications?: ApplicationsBlock;
  readonly industries?: readonly IndustryEntry[];
  readonly supply: SupplyBlock;
  readonly documentation: DocumentationBlock;
  readonly faq: readonly FaqEntry[];
};

/* ------------------------------------------------------------------ derived */

/**
 * The rows the specification table and the document register both address.
 *
 * Derived rather than stored, so the two sections cannot list different grades. A sub-range that
 * names individual grades contributes one row per grade; a sub-range that names none contributes
 * itself, because documents and typical properties are still issued against it.
 */
export type CatalogueRow = {
  readonly id: string;
  readonly label: string;
  /** The parent sub-range's id — what a property group's `subRangeIds` matches against. */
  readonly subRangeId: string;
  readonly subRange: string;
  /**
   * The parent sub-range's dimension, where the category has more than one.
   *
   * Derived, not authored: it is `SubRange.axis`, whose values come straight from the frozen
   * taxonomy's own words. It populates the specification table's optional second column, so a
   * multi-dimension category's table carries a real column beside the designation rather than a
   * grid whose only populated cell is a name.
   *
   * A single-hierarchy category has no axis, supplies no `groupingHeading`, and renders no second
   * column — which is the honest result, since it has no dimension to state.
   */
  readonly axis?: string;
  /** True when the row is the sub-range itself rather than a named grade inside it. */
  readonly isRange: boolean;
};

/**
 * The range, split into its dimensions.
 *
 * A category that sets no `axis` comes back as one unlabelled group holding every sub-range — so
 * a single-hierarchy category renders exactly as it did before this function existed. A category
 * organised by several dimensions comes back as one group per dimension, in fixture order.
 *
 * Shared by the hero's index and the range register so the two cannot disagree about how the
 * taxonomy is divided, and it is what lets the hero stay two-level on a category that names no
 * individual grades: the second level is the dimension when it is not the grade.
 */
export type SubRangeGroup = {
  readonly axis?: string;
  readonly subRanges: readonly SubRange[];
  /** Position of this group's first sub-range in the flat list, so numbering stays continuous. */
  readonly offset: number;
};

export function groupSubRanges(range: CategoryRange): readonly SubRangeGroup[] {
  const groups: SubRangeGroup[] = [];

  range.subRanges.forEach((subRange, index) => {
    const last = groups.at(-1);

    if (last && last.axis === subRange.axis) {
      (last.subRanges as SubRange[]).push(subRange);
      return;
    }

    groups.push({ axis: subRange.axis, subRanges: [subRange], offset: index });
  });

  return groups;
}

/** The sub-ranges belonging to one dimension. Used to resolve a selection step's options. */
export function subRangesOnAxis(range: CategoryRange, axis: string): readonly SubRange[] {
  return range.subRanges.filter((subRange) => subRange.axis === axis);
}

export function catalogueRows(range: CategoryRange): readonly CatalogueRow[] {
  return range.subRanges.flatMap((subRange): readonly CatalogueRow[] =>
    subRange.grades.length > 0
      ? subRange.grades.map((grade) => ({
          id: grade.id,
          label: grade.designation,
          subRangeId: subRange.id,
          subRange: subRange.designation,
          axis: subRange.axis,
          isRange: false,
        }))
      : [
          {
            id: subRange.id,
            label: subRange.designation,
            subRangeId: subRange.id,
            subRange: subRange.designation,
            axis: subRange.axis,
            isRange: true,
          },
        ],
  );
}

/**
 * Each property group paired with the rows its axis describes.
 *
 * The rule is stated once, here, and enforced rather than trusted: a group listing `subRangeIds`
 * takes exactly those sub-ranges; at most one group may omit the field, and it takes whatever is
 * left. Anything else throws at render — a sub-range described by two axes or by none is a
 * specification error, and it should fail loudly in development rather than quietly produce a
 * table with a missing row.
 *
 * A single-axis category declares one group with no ids and comes back as one pairing holding
 * every row, which is the shape the component rendered before groups existed.
 */
export type PropertyGroupRows = {
  readonly group: PropertyGroup;
  readonly rows: readonly CatalogueRow[];
};

export function propertyGroups(content: ProductCategoryContent): readonly PropertyGroupRows[] {
  const rows = catalogueRows(content.range);
  const groups = content.properties.groups;

  const open = groups.filter((group) => group.subRangeIds === undefined);
  if (open.length > 1) {
    throw new Error(
      `${content.familyId}: only one property group may omit subRangeIds; ${open.length} do`,
    );
  }

  const claimed = new Set<string>();
  for (const group of groups) {
    for (const id of group.subRangeIds ?? []) {
      if (claimed.has(id)) {
        throw new Error(`${content.familyId}: sub-range "${id}" is claimed by two property groups`);
      }
      claimed.add(id);
    }
  }

  const paired = groups.map((group) => ({
    group,
    rows:
      group.subRangeIds === undefined
        ? rows.filter((row) => !claimed.has(row.subRangeId))
        : rows.filter((row) => group.subRangeIds?.includes(row.subRangeId)),
  }));

  for (const { group, rows: groupRows } of paired) {
    if (groupRows.length === 0) {
      throw new Error(`${content.familyId}: property group "${group.id}" describes no sub-range`);
    }
  }

  const covered = paired.reduce((total, entry) => total + entry.rows.length, 0);
  if (covered !== rows.length) {
    throw new Error(
      `${content.familyId}: ${rows.length - covered} sub-range(s) have no property axis`,
    );
  }

  return paired;
}
