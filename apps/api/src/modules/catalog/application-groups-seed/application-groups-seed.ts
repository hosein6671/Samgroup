/**
 * ADR-029 §3, operations gate: the initial application groups and their product assignments, as
 * the owner approved them — Industrial Oils & Lubricants with the family page redesign, and Engine
 * Oils, Marine and Lubricant Additives on 28 October 2026. Antifreeze & Coolants (two products) and
 * Base Oils (none published) have no groups.
 *
 * Pure planning only. The plan creates missing groups, adds a missing Persian name, and assigns a
 * product only when it has no group yet: a product someone already placed in a group is reported,
 * never moved. Nothing else is written.
 */
export const SEED_ENABLE_ENV = "SAM_ALLOW_APPLICATION_GROUP_SEED";
export const SEED_TARGET_DATABASE = "sam_platform";
export const FAMILY_SLUG = "industrial-oils-lubricants";

export type SeedGroup = { slug: string; name: string; fa: string; products: readonly string[] };

export const INDUSTRIAL_GROUPS: readonly SeedGroup[] = [
  {
    slug: "compressors",
    name: "Compressors",
    fa: "کمپرسورها",
    products: [
      "compressor-tech",
      "compressor-tech-polyalphaolefin-synthetic-pao-s",
      "compressor-tech-refrigeration-compressor-oil",
      "compressor-oil-vb",
      "refrigerator-compressor-oil-kd",
    ],
  },
  {
    slug: "turbines",
    name: "Turbines",
    fa: "توربین‌ها",
    products: ["turbine-oil", "turbine-tech-gas-turbine-gt", "turbine-tech-radial-flow"],
  },
  {
    slug: "hydraulics",
    name: "Hydraulics",
    fa: "هیدرولیک",
    products: [
      "hydraulic-oil-hh-grade",
      "hydraulic-oil-hl-grade",
      "iso-vg-32",
      "iso-vg-46",
      "iso-vg-68",
      "iso-vg-100",
    ],
  },
  {
    slug: "gears-synthetics",
    name: "Gears & synthetics",
    fa: "دنده و روغن‌های سنتتیک",
    products: ["extreme-pressure-ep", "polyalphaolefin-pao", "polyalkylene-glycol-pag"],
  },
  { slug: "circulating", name: "Circulating", fa: "روغن‌های گردشی", products: ["circulating-oil"] },
  {
    slug: "heat-transfer",
    name: "Heat transfer",
    fa: "انتقال حرارت",
    products: ["heat-tech-heat-transfer-oil", "heat-tech-heat-metal-oil", "heat-transfer-oil"],
  },
  {
    slug: "metalworking",
    name: "Metalworking",
    fa: "فلزکاری",
    products: [
      "cutting-tech-cutting-oil",
      "quenching-oil",
      "rolling-tech-rolling-oil",
      "flashing-tech-flashing-oil",
    ],
  },
  { slug: "greases", name: "Greases", fa: "گریس‌ها", products: ["grease-based-on-calcium"] },
];

export const ENGINE_GROUPS: readonly SeedGroup[] = [
  {
    slug: "passenger-car-gasoline",
    name: "Passenger car (gasoline)",
    fa: "خودروی سواری بنزینی",
    products: [
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
    ],
  },
  {
    slug: "heavy-duty-diesel",
    name: "Heavy-duty diesel",
    fa: "دیزلی سنگین",
    products: [
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
      "cj4-grade",
      "cj-4-10w-40",
      "ck-4-10w-40",
      "locomotive-oil",
    ],
  },
  {
    slug: "motorcycle",
    name: "Motorcycle",
    fa: "موتورسیکلت",
    products: ["racing-grade", "sg-grade-motorcycle", "sn-grade-motorcycle"],
  },
  {
    slug: "automatic-transmission-fluids",
    name: "Automatic transmission fluids",
    fa: "روغن گیربکس اتوماتیک",
    products: ["al-4", "cvt", "dct", "dex-iii", "dex-vi", "mv", "sp-4"],
  },
  {
    slug: "gear-oils",
    name: "Gear oils",
    fa: "روغن دنده",
    products: ["gl-5-75w-80", "gl-5-75w-90", "gl-5-80w-90", "gl-5-85w-90", "gl-5-85w-140"],
  },
];

export const MARINE_GROUPS: readonly SeedGroup[] = [
  {
    slug: "medium-speed-engines",
    name: "Medium-speed engines",
    fa: "موتورهای دیزل دورمتوسط",
    products: ["lenj-oil", "trunk-oil", "special-trunk-oil", "super-trunk-oil"],
  },
  {
    slug: "other-marine-oils",
    name: "Other marine oils",
    fa: "سایر روان‌کارهای دریایی",
    products: [
      "reward-tech-marine-special",
      "reward-super-tech-semi-synthetic",
      "two-stroke-engine-oil",
    ],
  },
  {
    slug: "gear-transmission",
    name: "Gear & transmission",
    fa: "روغن دنده و گیربکس",
    products: ["gl-i-grade", "gl-3-grade", "gl-4-grade", "gl-5-grade", "atf-grade"],
  },
];

export const ADDITIVE_GROUPS: readonly SeedGroup[] = [
  {
    slug: "engine-oil-packages",
    name: "Engine oil packages",
    fa: "پکیج افزودنی روغن موتور",
    products: [
      "ci-4-ch-4-cf-4-cd-sc-cc-engine-oil-additive",
      "sf-se-sc-cc-engine-oil-additive",
      "sl-sj-sg-engine-oil-additive-package",
      "sn-sm-sl-sj-sf-sc-engine-oil-additive",
      "universal-engine-oil-additive",
      "diesel-engine-oil-additive-package",
      "two-stroke-motor-oil",
    ],
  },
  {
    slug: "industrial-packages",
    name: "Industrial packages",
    fa: "پکیج افزودنی صنعتی",
    products: ["anti-wear-hydraulic-oil-additive-package", "gear-oil-additive"],
  },
  {
    slug: "components",
    name: "Components",
    fa: "اجزای افزودنی",
    products: [
      "ash-free-antioxidant",
      "ash-less-dispersant",
      "dispersant",
      "molybdenum-compound",
      "tb-n400-booster",
      "zink-zddp",
    ],
  },
];

/** Every family the seed covers, in the order it runs. */
export const FAMILY_SEEDS: readonly { slug: string; groups: readonly SeedGroup[] }[] = [
  { slug: FAMILY_SLUG, groups: INDUSTRIAL_GROUPS },
  { slug: "engine-oils-automotive-lubricants", groups: ENGINE_GROUPS },
  { slug: "marine-oils-lubricants", groups: MARINE_GROUPS },
  { slug: "lubricant-additives", groups: ADDITIVE_GROUPS },
];

export type SeedState = {
  /** Null when the family itself is missing. */
  categoryId: string | null;
  /** Existing groups of the family by slug, with whether a Persian name exists. */
  groups: Map<string, { id: string; hasFa: boolean }>;
  /** Products by slug: their family and current group (null when none). */
  products: Map<string, { id: string; categoryId: string; groupSlug: string | null }>;
};

export type SeedPlan = {
  errors: string[];
  createGroups: SeedGroup[];
  addFaNames: SeedGroup[];
  assign: { productSlug: string; groupSlug: string }[];
  alreadyAssigned: number;
  keptElsewhere: { productSlug: string; groupSlug: string; current: string }[];
};

export function planSeed(
  state: SeedState,
  groups: readonly SeedGroup[] = INDUSTRIAL_GROUPS,
  familySlug: string = FAMILY_SLUG,
): SeedPlan {
  const plan: SeedPlan = {
    errors: [],
    createGroups: [],
    addFaNames: [],
    assign: [],
    alreadyAssigned: 0,
    keptElsewhere: [],
  };
  if (state.categoryId === null) {
    plan.errors.push(`No product family has the slug ${familySlug}.`);
    return plan;
  }
  for (const group of groups) {
    const existing = state.groups.get(group.slug);
    if (!existing) plan.createGroups.push(group);
    if (!existing || !existing.hasFa) plan.addFaNames.push(group);
    for (const productSlug of group.products) {
      const product = state.products.get(productSlug);
      if (!product) {
        plan.errors.push(`No product has the slug ${productSlug}.`);
        continue;
      }
      if (product.categoryId !== state.categoryId) {
        plan.errors.push(`${productSlug} is not in ${familySlug}.`);
        continue;
      }
      if (product.groupSlug === group.slug) plan.alreadyAssigned += 1;
      else if (product.groupSlug !== null)
        plan.keptElsewhere.push({ productSlug, groupSlug: group.slug, current: product.groupSlug });
      else plan.assign.push({ productSlug, groupSlug: group.slug });
    }
  }
  return plan;
}
