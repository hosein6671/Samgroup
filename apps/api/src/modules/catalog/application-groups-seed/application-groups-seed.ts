/**
 * ADR-029 §3, operations gate: the initial application groups of Industrial Oils & Lubricants and
 * their product assignments, as the owner approved them with the family page redesign
 * (28 October 2026).
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
    plan.errors.push(`No product family has the slug ${FAMILY_SLUG}.`);
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
        plan.errors.push(`${productSlug} is not in ${FAMILY_SLUG}.`);
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
