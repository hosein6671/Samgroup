import { FIXES, MOVED_TO_ENGINE, planFixes, planTypeNames, TYPE_NAMES_FA } from "./taxonomy-fix";

import type { ProductState } from "./taxonomy-fix";

const known = {
  families: new Set(["engine-oils-automotive-lubricants", "marine-oils-lubricants"]),
  types: new Set(["industrial-oils", "hydraulic-oils", "gear-oils"]),
  segments: new Set([
    "passenger-cars",
    "trucks-buses",
    "construction-mining",
    "agriculture",
    "marine",
  ]),
};

function before(): Map<string, ProductState> {
  return new Map(
    FIXES.map((fix) => [
      fix.slug,
      {
        family: fix.family?.from ?? "engine-oils-automotive-lubricants",
        type: fix.type?.from ?? null,
        segments: fix.family ? ["marine"] : [],
      },
    ]),
  );
}

describe("planFixes (ADR-030 §4)", () => {
  it("names each product once", () => {
    const slugs = FIXES.map((fix) => fix.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("moves the five gear rows to Engine Oils and swaps marine for vehicle segments", () => {
    const plan = planFixes(before(), known);
    expect(plan.errors).toEqual([]);
    for (const slug of MOVED_TO_ENGINE) {
      const change = plan.changes.find((item) => item.slug === slug);
      expect(change?.family).toBe("engine-oils-automotive-lubricants");
      expect(change?.remove).toEqual(["marine"]);
      expect(change?.add).toContain("passenger-cars");
    }
    expect(plan.changes.find((item) => item.slug === "hydraulic-oil-hh-grade")?.type).toBe(
      "hydraulic-oils",
    );
    expect(plan.changes.find((item) => item.slug === "extreme-pressure-ep")?.type).toBe(
      "gear-oils",
    );
  });

  it("is a no-op once applied", () => {
    const after = new Map(
      FIXES.map((fix) => [
        fix.slug,
        {
          family: fix.family?.to ?? "engine-oils-automotive-lubricants",
          type: fix.type?.to ?? null,
          segments: [...fix.addSegments],
        },
      ]),
    );
    const plan = planFixes(after, known);
    expect(plan.changes).toEqual([]);
    expect(plan.unchanged).toBe(FIXES.length);
  });

  it("never overwrites a value someone already changed, and refuses unknown data", () => {
    const state = before();
    state.set("gl-3-grade", {
      family: "industrial-oils-lubricants",
      type: null,
      segments: ["marine"],
    });
    state.set("extreme-pressure-ep", { family: "x", type: "greases", segments: [] });
    const plan = planFixes(state, known);
    expect(plan.kept).toHaveLength(2);
    expect(plan.changes.find((item) => item.slug === "gl-3-grade")).toBeUndefined();
    state.delete("cvt");
    expect(planFixes(state, known).errors).toContain("No product has the slug cvt.");
  });

  it("adds only missing Persian type names and never overwrites one", () => {
    const known = new Set(Object.keys(TYPE_NAMES_FA));
    expect(planTypeNames(new Map(), known).add).toHaveLength(8);
    const plan = planTypeNames(
      new Map([
        ["greases", "گریس‌ها"],
        ["gear-oils", "روغن دنده"],
      ]),
      known,
    );
    expect(plan.add).toHaveLength(6);
    expect(plan.kept).toHaveLength(1);
    expect(planTypeNames(new Map(), new Set()).errors).toHaveLength(8);
  });
});
