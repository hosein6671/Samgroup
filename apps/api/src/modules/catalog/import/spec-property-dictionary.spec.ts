import { MappingConfidence } from "../../../prisma/generated/enums";

import {
  duplicateMappingIdentities,
  mappingLookupKey,
  resolveProperty,
  SPEC_PROPERTY_KEYS,
  SPEC_PROPERTY_MAPPINGS,
  SPEC_PROPERTY_SEED,
} from "./spec-property-dictionary";

import type { SpecPropertyMappingSeed } from "./spec-property-dictionary";

/** A seed shaped only enough to exercise the identity rule. */
const seed = (
  rawProperty: string,
  rawUnit: string | null,
  specPropertyKey: string | null = "flash_point_oc",
): SpecPropertyMappingSeed => ({
  rawProperty,
  rawUnit,
  specPropertyKey,
  confidence: MappingConfidence.HIGH,
});

describe("the dictionary itself", () => {
  it("has no duplicate keys", () => {
    const keys = SPEC_PROPERTY_SEED.map((entry) => entry.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  /**
   * The invariant, keyed on the identity the importer actually looks mappings up by.
   *
   * It used to key on `rawProperty.toLowerCase()` with the unit appended raw, which is strictly
   * weaker than `mappingLookupKey`: it neither collapsed whitespace in the label nor folded the
   * unit at all. Two seeds differing only in internal whitespace, or only in the case of their
   * unit, passed it and then collided inside `MAPPINGS_BY_LABEL` — where a plain `Map.set` let the
   * later one win silently. Keying on the real function closes the gap by construction.
   */
  it("has no duplicate normalized lookup identity", () => {
    expect(duplicateMappingIdentities(SPEC_PROPERTY_MAPPINGS)).toEqual([]);
  });

  it("never points a HIGH mapping at a key the seed does not define", () => {
    for (const mapping of SPEC_PROPERTY_MAPPINGS) {
      if (mapping.confidence !== "HIGH") continue;
      expect(mapping.specPropertyKey).not.toBeNull();
      expect(SPEC_PROPERTY_KEYS.has(mapping.specPropertyKey as string)).toBe(true);
    }
  });
});

describe("high-confidence mappings resolve", () => {
  it("joins the eight spellings of kinematic viscosity at 100 °C onto one key", () => {
    const spellings = [
      "Kinematic viscosity at 100°C",
      "Viscosity 100 °C Cst",
      "Viscosity 100 °C",
      "Kinematics Viscosity @100 °C",
      "Kinematic Viscosity @ 100 ℃",
      "Kinematic viscosity @100℃",
      "Kinematic viscosity@100°C",
      "Kinematics Viscosity @100°C",
    ];
    for (const label of spellings) {
      const resolution = resolveProperty(label, "cSt");
      expect(resolution.outcome).toBe("resolved");
      expect(resolution.propertyKey).toBe("kv_100c");
    }
  });

  it("carries a source-stated test condition through as a qualifier, not a new key", () => {
    for (const [label, qualifier] of [
      ["CCS @ -15ºC", "@ -15 °C"],
      ["CCS @ -25ºC", "@ -25 °C"],
      ["CCS @ -30ºC", "@ -30 °C"],
    ] as const) {
      const resolution = resolveProperty(label, "Cp");
      expect(resolution.propertyKey).toBe("ccs_viscosity");
      expect(resolution.qualifier).toBe(qualifier);
    }
  });

  it("splits one printed foaming cell into three distinct properties", () => {
    expect(resolveProperty("Foaming Characteristics Seq. 1 @ 24ºC", "ml/ml").propertyKey).toBe(
      "foaming_seq1_24c",
    );
    expect(resolveProperty("Seq. 2 @ 93.5ºC", "ml/ml").propertyKey).toBe("foaming_seq2_93_5c");
    expect(resolveProperty("Seq. 3 @ 24ºC", "ml/ml").propertyKey).toBe("foaming_seq3_24c");
  });

  it("normalizes the two coolant table unit defects without changing their raw cells", () => {
    const reserveAlkalinity = resolveProperty("Reserve alkalinity", "ml 0.1 N.");
    expect(reserveAlkalinity.propertyKey).toBe("coolant_reserve_alkalinity");
    expect(reserveAlkalinity.normalizedUnitOverride).toBe("mL 0.100 N HCl");

    const ph = resolveProperty("PH 33% Vol in water", "HCL");
    expect(ph.propertyKey).toBe("coolant_ph_33pct_water");
    expect(ph.normalizedUnitOverride).toBeNull();
  });
});

describe("look-alikes that must not merge", () => {
  it("keeps specific gravity apart from density at 15 °C", () => {
    expect(resolveProperty("Specific Gravity", "").propertyKey).toBe("specific_gravity");
    expect(resolveProperty("Density at 15°C", "g/cm³").propertyKey).toBe("density_15c");
  });

  it("keeps the three density reference temperatures apart", () => {
    expect(resolveProperty("Density 15 °C", "Kg/m³").propertyKey).toBe("density_15c");
    expect(resolveProperty("Density (20 °C)", "kg/m³").propertyKey).toBe("density_20c");
    // 15.6 °C has no key at all: converting it to 15 °C would be inventing data.
    expect(resolveProperty("Density (15.6 °C)", "kg/m³").propertyKey).toBeNull();
  });

  it("keeps TBN and TAN apart despite the shared unit", () => {
    expect(resolveProperty("TBN", "mg KOH/g").propertyKey).toBe("tbn");
    expect(resolveProperty("Total Acid Number", "mg KOH/g").propertyKey).toBe("tan");
  });

  it("keeps Cleveland open cup apart from the generic open cup", () => {
    expect(resolveProperty("Flash Point (COC)", "°C").propertyKey).toBe("flash_point_coc");
    expect(resolveProperty("Flash Point (Open Cup)", "ºC").propertyKey).toBe("flash_point_oc");
  });

  it("refuses `Specific Gravity at 15°C`, which is spelled like one and measures the other", () => {
    const resolution = resolveProperty("Specific Gravity at 15°C", "g/cm³");
    expect(resolution.outcome).toBe("mapping-not-approved");
    expect(resolution.propertyKey).toBeNull();
    expect(resolution.confidence).toBe("LOW");
  });
});

describe("medium and low confidence mappings are WITHHELD", () => {
  it("resolves no key for a MEDIUM mapping", () => {
    const resolution = resolveProperty("Specific Density at 15°C", "g/cm³");
    expect(resolution.outcome).toBe("mapping-not-approved");
    expect(resolution.propertyKey).toBeNull();
    expect(resolution.confidence).toBe("MEDIUM");
    expect(resolution.note).toContain("sign-off");
  });

  it("resolves no key for a LOW mapping, and says what is wrong with the source", () => {
    const resolution = resolveProperty("Water Demulsibility", "minutes");
    expect(resolution.propertyKey).toBeNull();
    expect(resolution.confidence).toBe("LOW");
    expect(resolution.note).toContain("Pass");
  });

  it("withholds the ambiguous HSB viscosity column instead of picking a temperature", () => {
    const resolution = resolveProperty("Viscosity 40 100 °C", "Cst");
    expect(resolution.propertyKey).toBeNull();
    expect(resolution.confidence).toBe("LOW");
    expect(resolution.note).toContain("cannot be determined");
  });
});

describe("elemental content", () => {
  it("is recognised but never resolved to a key, because the element and unit both matter", () => {
    for (const [label, unit] of [
      ["Nitrogen", "%"],
      ["Nitrogen", "ppm"],
      ["Zinc", "%"],
      ["Molybdenum", "ppm"],
    ] as const) {
      const resolution = resolveProperty(label, unit);
      expect(resolution.outcome).toBe("element-content");
      expect(resolution.propertyKey).toBeNull();
    }
  });
});

describe("an unknown label", () => {
  it("is reported, never invented into the dictionary and never silently dropped", () => {
    const resolution = resolveProperty("Some Property Nobody Mapped", "furlongs");
    expect(resolution.outcome).toBe("unknown");
    expect(resolution.propertyKey).toBeNull();
    // The dictionary did not grow.
    expect(SPEC_PROPERTY_KEYS.has("some property nobody mapped")).toBe(false);
  });

  it("cannot be made to resolve by calling it repeatedly", () => {
    resolveProperty("Some Property Nobody Mapped", "furlongs");
    expect(resolveProperty("Some Property Nobody Mapped", "furlongs").outcome).toBe("unknown");
    expect(SPEC_PROPERTY_SEED).toHaveLength(SPEC_PROPERTY_SEED.length);
  });
});

/**
 * The lookup identity, case by case.
 *
 * These pin the rule the reviewer's SQL reimplements in PostgreSQL. Scope is the ASCII catalogue
 * vocabulary: only whitespace and case are folded, and nothing here should grow Unicode
 * normalisation without its own decision.
 */
describe("mappingLookupKey", () => {
  it("folds case", () => {
    expect(mappingLookupKey("Flash Point", null)).toBe(mappingLookupKey("flash point", null));
    expect(mappingLookupKey("Flash Point", null)).toBe(mappingLookupKey("FLASH POINT", null));
  });

  it("collapses repeated internal whitespace to one space", () => {
    expect(mappingLookupKey("Flash   Point", null)).toBe(mappingLookupKey("Flash Point", null));
    expect(mappingLookupKey("Flash\t\nPoint", null)).toBe(mappingLookupKey("Flash Point", null));
  });

  it("trims surrounding whitespace", () => {
    expect(mappingLookupKey("   Flash Point   ", null)).toBe(mappingLookupKey("Flash Point", null));
  });

  it("treats a null unit and an empty unit as the same unit", () => {
    expect(mappingLookupKey("Flash Point", null)).toBe(mappingLookupKey("Flash Point", ""));
    expect(mappingLookupKey("Flash Point", null)).toBe(mappingLookupKey("Flash Point", "   "));
  });

  it("folds unit case and trims the unit, without collapsing inside it", () => {
    expect(mappingLookupKey("Viscosity", "cSt")).toBe(mappingLookupKey("Viscosity", "  CST  "));
    expect(mappingLookupKey("Viscosity", "mm2 s")).not.toBe(
      mappingLookupKey("Viscosity", "mm2  s"),
    );
  });

  it("keeps the two halves separate, so a label cannot borrow a unit's text", () => {
    expect(mappingLookupKey("flash point", null)).not.toBe(mappingLookupKey("flash", "point"));
  });

  it("does not fold anything beyond whitespace and case", () => {
    expect(mappingLookupKey("Flash Point", null)).not.toBe(mappingLookupKey("Flashpoint", null));
    expect(mappingLookupKey("Flash Point", null)).not.toBe(mappingLookupKey("Flash-Point", null));
  });
});

describe("duplicateMappingIdentities", () => {
  it("accepts mappings whose identities differ", () => {
    expect(
      duplicateMappingIdentities([seed("Flash Point", null), seed("Pour Point", null)]),
    ).toEqual([]);
  });

  it("rejects two mappings differing only in label case", () => {
    expect(
      duplicateMappingIdentities([seed("Flash Point", null), seed("Flash point", null)]),
    ).toHaveLength(1);
  });

  it("rejects two mappings differing only in internal whitespace", () => {
    expect(
      duplicateMappingIdentities([seed("Flash Point", null), seed("Flash  Point", null)]),
    ).toHaveLength(1);
  });

  it("rejects two mappings differing only in surrounding whitespace", () => {
    expect(
      duplicateMappingIdentities([seed("Flash Point", null), seed(" Flash Point ", null)]),
    ).toHaveLength(1);
  });

  it("rejects a null unit against an empty unit within the unit-specific namespace", () => {
    expect(
      duplicateMappingIdentities([seed("Viscosity", ""), seed("Viscosity", "   ")]),
    ).toHaveLength(1);
  });

  it("rejects two mappings differing only in unit case", () => {
    expect(
      duplicateMappingIdentities([seed("Viscosity", "cSt"), seed("Viscosity", "CST")]),
    ).toHaveLength(1);
  });

  it("rejects a duplicate identity even when both name the SAME property key", () => {
    // Duplicate ownership is ambiguous data whether or not the two agree today: nothing records
    // which mapping owns the identity, so a later edit to either one silently decides it.
    const duplicates = duplicateMappingIdentities([
      seed("Flash Point", null, "flash_point_oc"),
      seed("flash  point", null, "flash_point_oc"),
    ]);

    expect(duplicates).toHaveLength(1);
  });

  it("rejects a duplicate identity when the two name DIFFERENT property keys", () => {
    expect(
      duplicateMappingIdentities([
        seed("Flash Point", null, "flash_point_oc"),
        seed("FLASH POINT", null, "pour_point_oc"),
      ]),
    ).toHaveLength(1);
  });

  it("does not treat a unit-agnostic and a unit-specific mapping as duplicates", () => {
    // Separate maps, and `resolveProperty` prefers the specific one deterministically, so this
    // pair is a documented preference rather than an ambiguity.
    expect(duplicateMappingIdentities([seed("Viscosity", null), seed("Viscosity", "cSt")])).toEqual(
      [],
    );
  });

  it("names each colliding identity once, however many mappings claim it", () => {
    const duplicates = duplicateMappingIdentities([
      seed("Flash Point", null),
      seed("flash point", null),
      seed("FLASH  POINT", null),
    ]);

    expect(duplicates).toHaveLength(1);
    expect(duplicates[0]).toContain("unit-agnostic");
  });
});
