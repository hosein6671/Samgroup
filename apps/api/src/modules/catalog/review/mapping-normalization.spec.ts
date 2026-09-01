import {
  SPEC_PROPERTY_MAPPINGS,
  duplicateMappingIdentities,
  mappingLookupKey,
  resolveProperty,
} from "../import/spec-property-dictionary";

import { PRODUCT_CLAIM_ELIGIBILITY_SQL, mappingMatchesFactSql } from "./review-eligibility";

/**
 * The rule the reviewer's SQL has to mirror, pinned on the side that owns it.
 *
 * ## Why this file exists
 *
 * `RESOLVED_MAPPING` in `review-eligibility.ts` decides whether a Specification's property mapping
 * resolves, and it must agree with how `resolveProperty` read the label and unit when the importer
 * WROTE the row. Those are two implementations of one lookup in two languages — they differ only
 * where `review-eligibility.ts` records that they do — and the only reason the
 * divergence that produced three false `PROPERTY_MAPPING_UNRESOLVED` findings survived review is
 * that nothing stated the rule anywhere but in the code.
 *
 * The SQL half cannot run without PostgreSQL, so the integration suite proves the two agree on
 * real rows. This file does what that suite cannot: it pins the CONTRACT — the exact normalisation,
 * case by case — with no database, so it runs on every machine and in CI, and it fails the moment
 * the importer's own rule moves.
 */
describe("the mapping lookup contract the reviewer SQL mirrors", () => {
  /** A HIGH, unit-agnostic seed. `resolveProperty` returns its key when the label resolves. */
  const LABEL = "Flash Point";
  const KEY = "flash_point_oc";

  const resolvedKey = (rawProperty: string, rawUnit: string): string | null => {
    const outcome = resolveProperty(rawProperty, rawUnit);
    return outcome.outcome === "resolved" ? outcome.propertyKey : null;
  };

  it("anchors the fixture: the exact seeded spelling resolves", () => {
    expect(resolvedKey(LABEL, "")).toBe(KEY);
  });

  describe("label normalisation — collapse internal whitespace, trim, fold case", () => {
    it.each([
      ["lower case", "flash point"],
      ["upper case", "FLASH POINT"],
      ["mixed case, the live defect", "Flash point"],
      ["repeated internal whitespace", "Flash   Point"],
      ["a tab as internal whitespace", "Flash\tPoint"],
      ["a newline as internal whitespace", "Flash\nPoint"],
      ["leading whitespace", "   Flash Point"],
      ["trailing whitespace", "Flash Point   "],
      ["every rule at once", "  fLaSh \t\n  pOiNt  "],
    ])("resolves with %s", (_label, rawProperty) => {
      expect(resolvedKey(rawProperty, "")).toBe(KEY);
    });

    it("does not fold anything beyond whitespace and case", () => {
      expect(resolvedKey("Flashpoint", "")).toBeNull();
      expect(resolvedKey("Flash-Point", "")).toBeNull();
    });
  });

  describe("unit normalisation — trim and fold case, a missing unit meaning empty", () => {
    /*
     * Every one of these resolves through the unit-AGNOSTIC seed, which ignores the unit entirely.
     * That is the point: a unit never blocks a generic mapping, which is the behaviour the SQL's
     * `m."raw_unit" IS NULL OR …` branch has to reproduce.
     */
    it.each([
      ["an empty unit", ""],
      ["a whitespace-only unit", "   "],
      ["a tab-only unit", "\t"],
      ["a populated unit", "°C"],
      ["a populated unit in another case", "°c"],
      ["a padded unit", "  °C  "],
    ])("a unit-agnostic mapping resolves with %s", (_label, rawUnit) => {
      expect(resolvedKey(LABEL, rawUnit)).toBe(KEY);
    });

    it("treats a missing unit as the empty unit, which is why the SQL coalesces", () => {
      // `resolveProperty` takes `string`; every caller passes `rawUnit ?? ""`. The SQL half must
      // therefore compare `coalesce(raw_unit, '')`, not `raw_unit`, or NULL never equals ''.
      const sql = mappingMatchesFactSql("m", "sf");

      expect(sql).toContain(`coalesce(sf."raw_unit", '')`);
      expect(sql).toContain(`coalesce(m."raw_unit", '')`);
    });
  });

  describe("confidence and approval, which normalisation does not widen", () => {
    it("does not resolve a MEDIUM mapping that names a key", () => {
      const outcome = resolveProperty("Specific Density at 15°C", "");

      expect(outcome.outcome).toBe("mapping-not-approved");
      expect(outcome.propertyKey).toBeNull();
    });

    it("does not resolve a MEDIUM mapping that names no key", () => {
      const outcome = resolveProperty("Density (15.6 °C)", "");

      expect(outcome.outcome).toBe("mapping-not-approved");
      expect(outcome.propertyKey).toBeNull();
    });

    it("still refuses a MEDIUM mapping under every normalised spelling", () => {
      expect(resolveProperty("  specific   DENSITY at 15°C ", "").outcome).toBe(
        "mapping-not-approved",
      );
    });

    it("reports an unknown label as unknown rather than resolving it", () => {
      expect(resolveProperty("No Such Property Label", "").outcome).toBe("unknown");
    });
  });

  /**
   * The ambiguity the normalisation creates, measured on the real dictionary.
   *
   * Normalising makes rows equivalent that the DATABASE still stores as distinct:
   * `spec_property_mappings_raw_property_raw_unit_key` is UNIQUE on the RAW pair and is NULLS
   * DISTINCT, so colliding rows remain representable there. That deferral is deliberate — current
   * data has none — so the SQL fails closed on ambiguity instead.
   *
   * On the IMPORTER side the question is now settled rather than deferred:
   * `duplicateMappingIdentities` runs at module load and throws, so a dictionary that would have
   * resolved by silent last-write-wins cannot be imported at all. These assertions record that the
   * seeded data satisfies it, which is what keeps the SQL's fail-closed branch unreachable today.
   */
  describe("normalised identity is unique across the dictionary", () => {
    it("no two seeds collapse to one lookup identity", () => {
      expect(duplicateMappingIdentities(SPEC_PROPERTY_MAPPINGS)).toEqual([]);
    });

    it("pins the reviewer SQL to the importer's own identity function, not a copy of it", () => {
      // `mappingLookupKey` is what `resolveProperty` looks mappings up by. The SQL mirrors these
      // exact foldings — collapse, trim, fold case on the label; trim and fold case on the unit,
      // with a missing unit meaning empty — and nothing else. ASCII catalogue vocabulary only.
      expect(mappingLookupKey("  Flash   POINT ", null)).toBe(mappingLookupKey("flash point", ""));
      expect(mappingLookupKey("Viscosity", " CST ")).toBe(mappingLookupKey("viscosity", "cSt"));
    });

    it("records the dormant case: the dictionary declares no unit-specific mapping", () => {
      // While this holds, the specific-over-generic tier in `RESOLVED_MAPPING` is unreachable on
      // seeded data. It is preserved because the importer preserves it, not because it is in use.
      expect(SPEC_PROPERTY_MAPPINGS.filter((mapping) => mapping.rawUnit !== null)).toEqual([]);
    });
  });

  /**
   * One predicate, two consumers.
   *
   * The gate and the reviewer-facing mapping list must join on the same rule. They now share the
   * constant instead of restating it, and these assertions are what stops a future edit from
   * quietly forking it back into two.
   */
  describe("the shared join predicate", () => {
    it("normalises the label on both sides", () => {
      const sql = mappingMatchesFactSql("m", "sf");

      expect(sql).toContain(`regexp_replace(m."raw_property", '\\s+', ' ', 'g')`);
      expect(sql).toContain(`regexp_replace(sf."raw_property", '\\s+', ' ', 'g')`);
      expect(sql).toContain("lower(btrim(");
    });

    it("lets a unit-agnostic mapping match on the label alone", () => {
      expect(mappingMatchesFactSql("m", "sf")).toContain(`m."raw_unit" IS NULL`);
    });

    it("renders against whatever aliases a caller supplies", () => {
      const sql = mappingMatchesFactSql("mm", "f");

      expect(sql).toContain(`mm."raw_property"`);
      expect(sql).toContain(`f."raw_property"`);
    });

    it("is a predicate only — it carries no confidence or review-status filter", () => {
      const sql = mappingMatchesFactSql("m", "sf");

      expect(sql).not.toContain("confidence");
      expect(sql).not.toContain("review_status");
    });

    it("does not leak into the claim gate, which has no property mapping", () => {
      expect(PRODUCT_CLAIM_ELIGIBILITY_SQL).not.toContain("spec_property_mappings");
    });
  });
});
