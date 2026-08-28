import {
  resolveProperty,
  SPEC_PROPERTY_KEYS,
  SPEC_PROPERTY_MAPPINGS,
  SPEC_PROPERTY_SEED,
} from "./spec-property-dictionary";

describe("the dictionary itself", () => {
  it("has no duplicate keys", () => {
    const keys = SPEC_PROPERTY_SEED.map((entry) => entry.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("has no duplicate (rawProperty, rawUnit) mapping", () => {
    const keys = SPEC_PROPERTY_MAPPINGS.map(
      (mapping) => `${mapping.rawProperty.toLowerCase()}|${mapping.rawUnit ?? ""}`,
    );
    expect(new Set(keys).size).toBe(keys.length);
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
