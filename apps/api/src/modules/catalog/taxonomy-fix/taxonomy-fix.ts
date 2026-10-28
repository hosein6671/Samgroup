/**
 * ADR-030 §4: the classification corrections the owner approved on 28 October 2026.
 *
 * Pure planning only — no database here. Each change applies only while the product still holds
 * the expected old value; anything else is reported and left alone, so a correction someone
 * already made in `/admin` is never overwritten. Segments are only added, except the `marine`
 * membership of the five rows that leave the Marine family.
 */
export const FIX_ENABLE_ENV = "SAM_ALLOW_TAXONOMY_FIX";
export const FIX_TARGET_DATABASE = "sam_platform";

const ENGINE = "engine-oils-automotive-lubricants";
const MARINE = "marine-oils-lubricants";

const GASOLINE = [
  "sc-grade",
  "sf-grade",
  "sg-grade-gasoline",
  "sj-grade",
  "sj-10w-40",
  "sj-20w-50",
  "sl-grade",
  "sl-10w-40",
  "sl-20w-50",
  "sm-grade",
  "sm-10w-40",
  "sm-20w-50",
  "sn-grade-gasoline",
  "sn-10w-40",
  "sn-5w-30",
  "sn-5w-40",
];
const DIESEL = [
  "cd-grade",
  "cf-4-15w-40",
  "cf-4-20w-50",
  "ch-4-grade",
  "ch-4-15w-40",
  "ch-4-20w-50",
  "ci4-grade",
  "ci-4-10w-40",
  "ci-4-15w-40",
  "ci-4-20w-50",
];
const NON_ROAD_DIESEL = ["cj4-grade", "cj-4-10w-40", "ck-4-10w-40"];
const ATF = ["al-4", "cvt", "dct", "dex-iii", "dex-vi", "mv", "sp-4"];
const GL5 = ["gl-5-75w-80", "gl-5-75w-90", "gl-5-80w-90", "gl-5-85w-90", "gl-5-85w-140"];
const COOLANTS = ["high-performance", "mineral-based"];
/** Filed under Marine by the workbook, automotive by their source section and designation. */
export const MOVED_TO_ENGINE = [
  "gl-i-grade",
  "gl-3-grade",
  "gl-4-grade",
  "gl-5-grade",
  "atf-grade",
];

export type ProductFix = {
  slug: string;
  /** Move to this family, only from `fromFamily`. */
  family?: { from: string; to: string };
  /** Set this Product Type, only from `fromType`. */
  type?: { from: string; to: string };
  addSegments: readonly string[];
  removeSegments: readonly string[];
};

const seg = (slugs: readonly string[], add: readonly string[]): ProductFix[] =>
  slugs.map((slug) => ({ slug, addSegments: add, removeSegments: [] }));

export const FIXES: readonly ProductFix[] = [
  ...seg(GASOLINE, ["passenger-cars"]),
  ...seg(DIESEL, ["trucks-buses"]),
  ...seg(NON_ROAD_DIESEL, ["trucks-buses", "construction-mining", "agriculture"]),
  ...seg(ATF, ["passenger-cars"]),
  ...seg(GL5, ["passenger-cars", "trucks-buses"]),
  ...seg(COOLANTS, ["passenger-cars", "trucks-buses"]),
  ...MOVED_TO_ENGINE.map((slug) => ({
    slug,
    family: { from: MARINE, to: ENGINE },
    addSegments: slug === "atf-grade" ? ["passenger-cars"] : ["passenger-cars", "trucks-buses"],
    removeSegments: ["marine"],
  })),
  ...["hydraulic-oil-hh-grade", "hydraulic-oil-hl-grade"].map((slug) => ({
    slug,
    type: { from: "industrial-oils", to: "hydraulic-oils" },
    addSegments: [],
    removeSegments: [],
  })),
  ...["extreme-pressure-ep", "polyalphaolefin-pao", "polyalkylene-glycol-pag"].map((slug) => ({
    slug,
    type: { from: "industrial-oils", to: "gear-oils" },
    addSegments: [],
    removeSegments: [],
  })),
];

export type ProductState = { family: string; type: string | null; segments: readonly string[] };

export type FixPlanItem = {
  slug: string;
  family?: string;
  type?: string;
  add: string[];
  remove: string[];
};

export type FixPlan = {
  errors: string[];
  changes: FixPlanItem[];
  kept: string[];
  unchanged: number;
};

export function planFixes(
  products: ReadonlyMap<string, ProductState>,
  known: {
    families: ReadonlySet<string>;
    types: ReadonlySet<string>;
    segments: ReadonlySet<string>;
  },
  fixes: readonly ProductFix[] = FIXES,
): FixPlan {
  const plan: FixPlan = { errors: [], changes: [], kept: [], unchanged: 0 };
  for (const fix of fixes) {
    const product = products.get(fix.slug);
    if (!product) {
      plan.errors.push(`No product has the slug ${fix.slug}.`);
      continue;
    }
    for (const segment of [...fix.addSegments, ...fix.removeSegments])
      if (!known.segments.has(segment)) plan.errors.push(`No Segment has the slug ${segment}.`);
    if (fix.family && !known.families.has(fix.family.to))
      plan.errors.push(`No family has the slug ${fix.family.to}.`);
    if (fix.type && !known.types.has(fix.type.to))
      plan.errors.push(`No Product Type has the slug ${fix.type.to}.`);

    const item: FixPlanItem = { slug: fix.slug, add: [], remove: [] };
    if (fix.family && product.family !== fix.family.to) {
      if (product.family === fix.family.from) item.family = fix.family.to;
      else plan.kept.push(`${fix.slug}: family is ${product.family}, not ${fix.family.from}`);
    }
    if (fix.type && product.type !== fix.type.to) {
      if (product.type === fix.type.from) item.type = fix.type.to;
      else plan.kept.push(`${fix.slug}: type is ${String(product.type)}, not ${fix.type.from}`);
    }
    // A segment change follows its family move: a row kept in another family keeps its segments.
    const familyKept =
      fix.family !== undefined && item.family === undefined && product.family !== fix.family.to;
    if (!familyKept) {
      item.add = fix.addSegments.filter((segment) => !product.segments.includes(segment));
      item.remove = fix.removeSegments.filter((segment) => product.segments.includes(segment));
    }
    if (item.family || item.type || item.add.length > 0 || item.remove.length > 0)
      plan.changes.push(item);
    else plan.unchanged += 1;
  }
  return plan;
}
