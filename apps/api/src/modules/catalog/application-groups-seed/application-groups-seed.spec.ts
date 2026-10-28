import { FAMILY_SEEDS, INDUSTRIAL_GROUPS, planSeed } from "./application-groups-seed";

import type { SeedState } from "./application-groups-seed";

function state(overrides: Partial<SeedState> = {}): SeedState {
  const products = new Map(
    INDUSTRIAL_GROUPS.flatMap((group) => group.products).map((slug) => [
      slug,
      { id: slug, categoryId: "c1", groupSlug: null as string | null },
    ]),
  );
  return { categoryId: "c1", groups: new Map(), products, ...overrides };
}

describe("planSeed (ADR-029 initial groups)", () => {
  it("covers every Industrial Oils & Lubricants product exactly once", () => {
    const slugs = INDUSTRIAL_GROUPS.flatMap((group) => group.products);
    expect(slugs).toHaveLength(26);
    expect(new Set(slugs).size).toBe(26);
  });

  it("plans eight groups, their Persian names and 26 assignments on an empty family", () => {
    const plan = planSeed(state());
    expect(plan.errors).toEqual([]);
    expect(plan.createGroups).toHaveLength(8);
    expect(plan.addFaNames).toHaveLength(8);
    expect(plan.assign).toHaveLength(26);
  });

  it("is a no-op once applied", () => {
    const groups = new Map(
      INDUSTRIAL_GROUPS.map((group) => [group.slug, { id: group.slug, hasFa: true }]),
    );
    const products = new Map(
      INDUSTRIAL_GROUPS.flatMap((group) =>
        group.products.map((slug) => [slug, { id: slug, categoryId: "c1", groupSlug: group.slug }]),
      ),
    );
    const plan = planSeed(state({ groups, products }));
    expect(plan).toMatchObject({
      createGroups: [],
      addFaNames: [],
      assign: [],
      alreadyAssigned: 26,
    });
  });

  it("never moves a product someone already placed, and refuses missing data", () => {
    const base = state();
    base.products.set("turbine-oil", { id: "t", categoryId: "c1", groupSlug: "custom" });
    expect(planSeed(base).keptElsewhere).toEqual([
      { productSlug: "turbine-oil", groupSlug: "turbines", current: "custom" },
    ]);
    expect(planSeed(state({ categoryId: null })).errors).toHaveLength(1);
    const missing = state();
    missing.products.delete("iso-vg-32");
    expect(planSeed(missing).errors).toEqual(["No product has the slug iso-vg-32."]);
  });

  it("covers every product of the other three families exactly once", () => {
    const counts = Object.fromEntries(
      FAMILY_SEEDS.map((family) => {
        const slugs = family.groups.flatMap((group) => group.products);
        expect(new Set(slugs).size).toBe(slugs.length);
        return [family.slug, slugs.length];
      }),
    );
    expect(counts).toEqual({
      "industrial-oils-lubricants": 26,
      "engine-oils-automotive-lubricants": 50,
      "marine-oils-lubricants": 7,
      "lubricant-additives": 15,
    });
  });
});
