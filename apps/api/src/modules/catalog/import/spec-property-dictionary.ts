/**
 * The controlled technical-property dictionary, and the raw-label mappings that reach it.
 *
 * ── Two tables, and the line between them ───────────────────────────────────
 *
 * `SPEC_PROPERTY_SEED` is `spec_properties` — approved domain truth by construction. Only
 * HIGH-confidence normalizations are here: same quantity, same method, unambiguous across
 * every source that states it.
 *
 * `SPEC_PROPERTY_MAPPINGS` is `spec_property_mappings` — a proposed correspondence between
 * a raw source label and a dictionary key, carrying its own confidence and its own review
 * status. A MEDIUM or LOW row lives here and NOWHERE else; it is stored so the proposal is
 * visible and reviewable, and it resolves to no `propertyKey` until a human agrees with it.
 *
 * ── The importer never invents a property ───────────────────────────────────
 *
 * `resolveProperty` can only ever return a key that is already in the seed. An unknown raw
 * label produces a conflict and an unmapped-property report entry — never a new dictionary
 * entry, and never a silent drop.
 *
 * ── Look-alikes that must not merge ─────────────────────────────────────────
 *
 * Several pairs share a spelling or a unit and are different quantities. Each is a separate
 * key, and the mapping table is keyed on `(rawProperty, rawUnit)` precisely so the unit can
 * decide which one a label means:
 *
 *   specific_gravity vs density_15c   dimensionless ratio vs mass/volume
 *   density_15c / _20c / _15_6c       three reference temperatures, not one property
 *   tbn vs tan                        both mg KOH/g, opposite quantities
 *   flash_point_coc vs flash_point_oc King Power distinguishes them; the others do not
 *   nitrogen % vs nitrogen ppm        one element, two units, two methods
 *   colour vs colour_number           a visual description vs an ASTM D1500 reading
 *   ccs at -15/-20/-25/-30 C          four tests; the temperature is a qualifier, not a key
 */

import {
  MappingConfidence,
  MethodRequirement,
  SpecValueKind,
} from "../../../prisma/generated/enums";

export interface SpecPropertySeed {
  readonly key: string;
  readonly canonicalMeaning: string;
  readonly quantity: string;
  readonly valueKind: SpecValueKind;
  readonly allowedUnits: readonly string[];
  readonly methodRequirement: MethodRequirement;
}

/**
 * The HIGH-confidence dictionary. Every entry is a quantity all its source labels agree on.
 * Nothing here is seeded by this gate — the importer reads it to validate, and an apply gate
 * would seed it after review.
 */
export const SPEC_PROPERTY_SEED: readonly SpecPropertySeed[] = [
  {
    key: "kv_100c",
    canonicalMeaning: "Kinematic viscosity measured at 100 degrees Celsius.",
    quantity: "kinematic_viscosity",
    valueKind: SpecValueKind.NUMERIC,
    // `Cst`, `cSt`, `mm²/s` and `mm²/sec` are the SAME unit written four ways
    // across the three sources. Accepting all four is not a conversion and loses nothing:
    // the printed form is still stored verbatim on the specification row.
    allowedUnits: ["cSt", "Cst", "mm²/s", "mm²/sec"],
    methodRequirement: MethodRequirement.REQUIRED,
  },
  {
    key: "kv_40c",
    canonicalMeaning: "Kinematic viscosity measured at 40 degrees Celsius.",
    quantity: "kinematic_viscosity",
    valueKind: SpecValueKind.NUMERIC,
    // `Cst`, `cSt`, `mm²/s` and `mm²/sec` are the SAME unit written four ways
    // across the three sources. Accepting all four is not a conversion and loses nothing:
    // the printed form is still stored verbatim on the specification row.
    allowedUnits: ["cSt", "Cst", "mm²/s", "mm²/sec"],
    methodRequirement: MethodRequirement.REQUIRED,
  },
  {
    key: "kv_100c_after_shear_30cyc",
    canonicalMeaning:
      "Kinematic viscosity at 100 degrees Celsius after 30-cycle shear conditioning.",
    quantity: "kinematic_viscosity",
    valueKind: SpecValueKind.NUMERIC,
    // `Cst`, `cSt`, `mm²/s` and `mm²/sec` are the SAME unit written four ways
    // across the three sources. Accepting all four is not a conversion and loses nothing:
    // the printed form is still stored verbatim on the specification row.
    allowedUnits: ["cSt", "Cst", "mm²/s", "mm²/sec"],
    methodRequirement: MethodRequirement.REQUIRED,
  },
  {
    key: "viscosity_loss_shear",
    canonicalMeaning: "Proportion of viscosity lost after shear conditioning.",
    quantity: "ratio",
    valueKind: SpecValueKind.NUMERIC,
    allowedUnits: ["%"],
    methodRequirement: MethodRequirement.REQUIRED,
  },
  {
    key: "viscosity_index",
    canonicalMeaning: "Viscosity index — the dimensionless measure of viscosity/temperature.",
    quantity: "dimensionless",
    valueKind: SpecValueKind.NUMERIC,
    allowedUnits: [],
    methodRequirement: MethodRequirement.REQUIRED,
  },
  {
    key: "specific_gravity",
    canonicalMeaning:
      "Specific gravity — a DIMENSIONLESS ratio. Never the same property as density_15c.",
    quantity: "dimensionless_ratio",
    valueKind: SpecValueKind.NUMERIC,
    allowedUnits: [],
    methodRequirement: MethodRequirement.REQUIRED,
  },
  {
    key: "density_15c",
    canonicalMeaning: "Density at a reference temperature of 15 degrees Celsius.",
    quantity: "density",
    valueKind: SpecValueKind.NUMERIC,
    allowedUnits: ["g/cm³", "kg/m³", "Kg/m³"],
    methodRequirement: MethodRequirement.REQUIRED,
  },
  {
    key: "density_20c",
    canonicalMeaning: "Density at a reference temperature of 20 degrees Celsius.",
    quantity: "density",
    valueKind: SpecValueKind.NUMERIC,
    allowedUnits: ["kg/m³", "Kg/m³"],
    methodRequirement: MethodRequirement.OPTIONAL,
  },
  {
    key: "flash_point_oc",
    canonicalMeaning: "Flash point measured by an open-cup method.",
    quantity: "temperature",
    valueKind: SpecValueKind.NUMERIC,
    // Three codepoints for one unit: U+00B0 DEGREE SIGN, U+00BA MASCULINE ORDINAL (the
    // King Power fonts) and U+2103 DEGREE CELSIUS (Addilex). All are degrees Celsius.
    allowedUnits: ["°C", "ºC", "℃"],
    methodRequirement: MethodRequirement.REQUIRED,
  },
  {
    key: "flash_point_coc",
    canonicalMeaning:
      "Flash point measured specifically by Cleveland open cup. Not merged with flash_point_oc.",
    quantity: "temperature",
    valueKind: SpecValueKind.NUMERIC,
    // Three codepoints for one unit: U+00B0 DEGREE SIGN, U+00BA MASCULINE ORDINAL (the
    // King Power fonts) and U+2103 DEGREE CELSIUS (Addilex). All are degrees Celsius.
    allowedUnits: ["°C", "ºC", "℃"],
    methodRequirement: MethodRequirement.REQUIRED,
  },
  {
    key: "pour_point",
    canonicalMeaning: "Pour point — the lowest temperature at which the fluid still flows.",
    quantity: "temperature",
    valueKind: SpecValueKind.NUMERIC,
    // Three codepoints for one unit: U+00B0 DEGREE SIGN, U+00BA MASCULINE ORDINAL (the
    // King Power fonts) and U+2103 DEGREE CELSIUS (Addilex). All are degrees Celsius.
    allowedUnits: ["°C", "ºC", "℃"],
    methodRequirement: MethodRequirement.REQUIRED,
  },
  {
    key: "tbn",
    canonicalMeaning: "Total base number. Opposite quantity to tan, which shares its unit.",
    quantity: "alkalinity",
    valueKind: SpecValueKind.NUMERIC,
    allowedUnits: ["mg KOH/g", "MgKOH/g"],
    methodRequirement: MethodRequirement.REQUIRED,
  },
  {
    key: "tan",
    canonicalMeaning: "Total acid number. Opposite quantity to tbn, which shares its unit.",
    quantity: "acidity",
    valueKind: SpecValueKind.NUMERIC,
    allowedUnits: ["mg KOH/g"],
    methodRequirement: MethodRequirement.REQUIRED,
  },
  {
    key: "noack_volatility",
    canonicalMeaning: "Noack evaporative loss.",
    quantity: "mass_fraction",
    valueKind: SpecValueKind.NUMERIC,
    allowedUnits: ["%wt", "%"],
    methodRequirement: MethodRequirement.REQUIRED,
  },
  {
    key: "ccs_viscosity",
    canonicalMeaning:
      "Cold cranking simulator dynamic viscosity. The TEST TEMPERATURE is a qualifier on the " +
      "specification row, not part of this key.",
    quantity: "dynamic_viscosity",
    valueKind: SpecValueKind.NUMERIC,
    allowedUnits: ["Cp", "cP", "mPa·s"],
    methodRequirement: MethodRequirement.REQUIRED,
  },
  {
    key: "foaming_seq1_24c",
    canonicalMeaning: "Foaming characteristics, Sequence 1 at 24 degrees Celsius.",
    quantity: "volume_ratio",
    valueKind: SpecValueKind.NUMERIC,
    allowedUnits: ["ml/ml"],
    methodRequirement: MethodRequirement.REQUIRED,
  },
  {
    key: "foaming_seq2_93_5c",
    canonicalMeaning: "Foaming characteristics, Sequence 2 at 93.5 degrees Celsius.",
    quantity: "volume_ratio",
    valueKind: SpecValueKind.NUMERIC,
    allowedUnits: ["ml/ml"],
    methodRequirement: MethodRequirement.REQUIRED,
  },
  {
    key: "foaming_seq3_24c",
    canonicalMeaning: "Foaming characteristics, Sequence 3 at 24 degrees Celsius.",
    quantity: "volume_ratio",
    valueKind: SpecValueKind.NUMERIC,
    allowedUnits: ["ml/ml"],
    methodRequirement: MethodRequirement.REQUIRED,
  },
  {
    key: "copper_corrosion",
    canonicalMeaning:
      "Copper strip corrosion classification code. The test temperature and the oil/grease " +
      "method difference are carried as qualifier and method.",
    quantity: "classification_code",
    valueKind: SpecValueKind.CODED,
    allowedUnits: [],
    methodRequirement: MethodRequirement.REQUIRED,
  },
  {
    key: "air_release_50c",
    canonicalMeaning: "Air release time at 50 degrees Celsius.",
    quantity: "time",
    valueKind: SpecValueKind.NUMERIC,
    allowedUnits: ["minutes"],
    methodRequirement: MethodRequirement.REQUIRED,
  },
  {
    key: "four_ball_weld_load",
    canonicalMeaning: "Four-ball weld load.",
    quantity: "force",
    valueKind: SpecValueKind.NUMERIC,
    allowedUnits: ["kgf"],
    methodRequirement: MethodRequirement.REQUIRED,
  },
  {
    key: "appearance",
    canonicalMeaning: "Visual appearance, as free text. Not comparable between products.",
    quantity: "description",
    valueKind: SpecValueKind.TEXTUAL,
    allowedUnits: [],
    methodRequirement: MethodRequirement.OPTIONAL,
  },
  {
    key: "moisture_water",
    canonicalMeaning: "Water or moisture content by mass.",
    quantity: "mass_fraction",
    valueKind: SpecValueKind.NUMERIC,
    allowedUnits: ["%"],
    methodRequirement: MethodRequirement.REQUIRED,
  },
  {
    key: "grease_penetration_worked",
    canonicalMeaning: "Worked penetration of a grease.",
    quantity: "penetration",
    valueKind: SpecValueKind.NUMERIC,
    allowedUnits: ["0.1 mm"],
    methodRequirement: MethodRequirement.REQUIRED,
  },
  {
    key: "drop_point",
    canonicalMeaning: "Drop point of a grease.",
    quantity: "temperature",
    valueKind: SpecValueKind.NUMERIC,
    allowedUnits: ["°C"],
    methodRequirement: MethodRequirement.REQUIRED,
  },
  {
    key: "grease_free_alkali",
    canonicalMeaning: "Free alkali content of a grease.",
    quantity: "mass_fraction",
    valueKind: SpecValueKind.NUMERIC,
    allowedUnits: ["%"],
    methodRequirement: MethodRequirement.REQUIRED,
  },
  {
    key: "coolant_reserve_alkalinity",
    canonicalMeaning:
      "Reserve alkalinity of an engine coolant, reported as the volume of 0.100 N hydrochloric acid required by ASTM D1121.",
    quantity: "reserve_alkalinity",
    valueKind: SpecValueKind.NUMERIC,
    allowedUnits: ["mL 0.100 N HCl"],
    methodRequirement: MethodRequirement.REQUIRED,
  },
  {
    key: "coolant_ph_33pct_water",
    canonicalMeaning: "pH of a 33 percent by-volume engine-coolant solution in water.",
    quantity: "ph",
    valueKind: SpecValueKind.NUMERIC,
    allowedUnits: [],
    methodRequirement: MethodRequirement.REQUIRED,
  },
] as const;

export const SPEC_PROPERTY_KEYS: ReadonlySet<string> = new Set(
  SPEC_PROPERTY_SEED.map((entry) => entry.key),
);

export interface SpecPropertyMappingSeed {
  readonly rawProperty: string;
  /** `null` means "this label whatever unit it carries". A unit-specific row wins over it. */
  readonly rawUnit: string | null;
  /** `null` records that the label was seen and has no agreed mapping. */
  readonly specPropertyKey: string | null;
  readonly confidence: MappingConfidence;
  readonly note?: string;
  /** A source-stated test condition the key deliberately does not encode. */
  readonly qualifier?: string;
  /**
   * Canonical unit for the normalized Specification when the printed unit cell is a known
   * source-layout defect. `null` means dimensionless. The SourceFact always keeps `rawUnit`.
   */
  readonly normalizedUnitOverride?: string | null;
}

/**
 * Raw label -> dictionary key. HIGH rows resolve; MEDIUM and LOW rows do not, and their
 * facts are planned with no `propertyKey`, `NEEDS_REVIEW`, and an explicit flag.
 *
 * Labels are matched after collapsing whitespace and lowercasing — never after stripping
 * punctuation, because `Nitrogen, %` and `Nitrogen, ppm` differ only in punctuation and
 * unit and are two different facts.
 */
export const SPEC_PROPERTY_MAPPINGS: readonly SpecPropertyMappingSeed[] = [
  // ── Kinematic viscosity ───────────────────────────────────────────────────
  {
    rawProperty: "Kinematic viscosity at 100°C",
    rawUnit: null,
    specPropertyKey: "kv_100c",
    confidence: MappingConfidence.HIGH,
  },
  {
    rawProperty: "Kinematic Viscosity @100°C",
    rawUnit: null,
    specPropertyKey: "kv_100c",
    confidence: MappingConfidence.HIGH,
  },
  {
    rawProperty: "Kinematics Viscosity @100 °C",
    rawUnit: null,
    specPropertyKey: "kv_100c",
    confidence: MappingConfidence.HIGH,
  },
  {
    rawProperty: "Kinematic Viscosity @100 °C",
    rawUnit: null,
    specPropertyKey: "kv_100c",
    confidence: MappingConfidence.HIGH,
  },
  {
    rawProperty: "Viscosity 100 °C Cst",
    rawUnit: null,
    specPropertyKey: "kv_100c",
    confidence: MappingConfidence.HIGH,
  },
  {
    rawProperty: "Viscosity 100 °C",
    rawUnit: null,
    specPropertyKey: "kv_100c",
    confidence: MappingConfidence.HIGH,
  },
  // Six more spellings of the same quantity, each observed verbatim in a source. Listed
  // one by one rather than matched loosely: a fuzzy rule that joined these would also join
  // things that must never be joined, and the whole point of this table is that the merges
  // were decided individually.
  {
    rawProperty: "Kinematic Viscosity @ 100 ℃",
    rawUnit: null,
    specPropertyKey: "kv_100c",
    confidence: MappingConfidence.HIGH,
  },
  {
    rawProperty: "Kinematic viscosity @100℃",
    rawUnit: null,
    specPropertyKey: "kv_100c",
    confidence: MappingConfidence.HIGH,
  },
  {
    rawProperty: "Kinematic viscosity@100°C",
    rawUnit: null,
    specPropertyKey: "kv_100c",
    confidence: MappingConfidence.HIGH,
  },
  {
    rawProperty: "Kinematics Viscosity @100°C",
    rawUnit: null,
    specPropertyKey: "kv_100c",
    confidence: MappingConfidence.HIGH,
  },
  {
    rawProperty: "Kinematic Viscosity @ 40℃",
    rawUnit: null,
    specPropertyKey: "kv_40c",
    confidence: MappingConfidence.HIGH,
  },
  {
    rawProperty: "Density (20 ℃)",
    rawUnit: null,
    specPropertyKey: "density_20c",
    confidence: MappingConfidence.HIGH,
  },
  {
    rawProperty: "Density (20°C)",
    rawUnit: null,
    specPropertyKey: "density_20c",
    confidence: MappingConfidence.HIGH,
  },
  {
    rawProperty: "Kinematic viscosity at 40°C",
    rawUnit: null,
    specPropertyKey: "kv_40c",
    confidence: MappingConfidence.HIGH,
  },
  {
    rawProperty: "Kinematic Viscosity @ 40°C",
    rawUnit: null,
    specPropertyKey: "kv_40c",
    confidence: MappingConfidence.HIGH,
  },
  {
    rawProperty: "Viscosity 40 °C Cst",
    rawUnit: null,
    specPropertyKey: "kv_40c",
    confidence: MappingConfidence.HIGH,
  },
  {
    rawProperty: "Viscosity 40 °C",
    rawUnit: null,
    specPropertyKey: "kv_40c",
    confidence: MappingConfidence.HIGH,
  },
  {
    rawProperty: "Viscosity 40 100 °C",
    rawUnit: null,
    specPropertyKey: null,
    confidence: MappingConfidence.LOW,
    note:
      "HSB page 42 heads a SINGLE value column with two temperatures. Whether the values are " +
      "at 40 °C or 100 °C cannot be determined from the page; mapping to either would invent it.",
  },
  {
    rawProperty: "Kinematic viscosity at 100°C After Shear, 30 Cycles (ASTM D6278)",
    rawUnit: null,
    specPropertyKey: "kv_100c_after_shear_30cyc",
    confidence: MappingConfidence.HIGH,
    note: "Carries two methods: D445 measures, D6278 conditions. D6278 is kept as qualifier.",
    qualifier: "After shear, 30 cycles (ASTM D6278)",
  },
  {
    rawProperty: "Viscosity Loss",
    rawUnit: null,
    specPropertyKey: "viscosity_loss_shear",
    confidence: MappingConfidence.HIGH,
  },

  // ── Viscosity index ───────────────────────────────────────────────────────
  {
    rawProperty: "Viscosity Index",
    rawUnit: null,
    specPropertyKey: "viscosity_index",
    confidence: MappingConfidence.HIGH,
  },

  // ── Density family — three reference temperatures, never merged ───────────
  {
    rawProperty: "Specific Gravity",
    rawUnit: null,
    specPropertyKey: "specific_gravity",
    confidence: MappingConfidence.HIGH,
  },
  {
    rawProperty: "Density at 15°C",
    rawUnit: null,
    specPropertyKey: "density_15c",
    confidence: MappingConfidence.HIGH,
  },
  {
    rawProperty: "Density 15 °C Kg/m³",
    rawUnit: null,
    specPropertyKey: "density_15c",
    confidence: MappingConfidence.HIGH,
  },
  {
    rawProperty: "Density 15 °C",
    rawUnit: null,
    specPropertyKey: "density_15c",
    confidence: MappingConfidence.HIGH,
  },
  {
    rawProperty: "Density (15℃)",
    rawUnit: null,
    specPropertyKey: "density_15c",
    confidence: MappingConfidence.HIGH,
  },
  {
    rawProperty: "Specific Density at 15°C",
    rawUnit: null,
    specPropertyKey: "density_15c",
    confidence: MappingConfidence.MEDIUM,
    note: "King Power writes a density under a 'specific' label. Reads as density_15c; needs sign-off.",
  },
  {
    rawProperty: "Specific Gravity at 15°C",
    rawUnit: null,
    specPropertyKey: null,
    confidence: MappingConfidence.LOW,
    note: "Spelled like specific_gravity but the value is a density. Must not merge with either without sign-off.",
  },
  {
    rawProperty: "Density (20 °C)",
    rawUnit: null,
    specPropertyKey: "density_20c",
    confidence: MappingConfidence.HIGH,
  },
  {
    rawProperty: "Density (15.6 °C)",
    rawUnit: null,
    specPropertyKey: null,
    confidence: MappingConfidence.MEDIUM,
    note: "A third reference temperature. No dictionary entry; converting to 15 °C would invent data.",
  },

  // ── Flash point — COC and generic open cup stay apart ─────────────────────
  {
    rawProperty: "Flash Point (Open Cup)",
    rawUnit: null,
    specPropertyKey: "flash_point_oc",
    confidence: MappingConfidence.HIGH,
  },
  {
    rawProperty: "Flash Point(Open Cup)",
    rawUnit: null,
    specPropertyKey: "flash_point_oc",
    confidence: MappingConfidence.HIGH,
  },
  {
    rawProperty: "Flash Point °C",
    rawUnit: null,
    specPropertyKey: "flash_point_oc",
    confidence: MappingConfidence.HIGH,
  },
  {
    rawProperty: "Flash Point",
    rawUnit: null,
    specPropertyKey: "flash_point_oc",
    confidence: MappingConfidence.HIGH,
  },
  {
    rawProperty: "Flash Point (COC)",
    rawUnit: null,
    specPropertyKey: "flash_point_coc",
    confidence: MappingConfidence.HIGH,
  },

  // ── Pour point ────────────────────────────────────────────────────────────
  {
    rawProperty: "Pour Point",
    rawUnit: null,
    specPropertyKey: "pour_point",
    confidence: MappingConfidence.HIGH,
  },
  // Lookup is case-insensitive, so `Pour point °C` needs no row of its own.
  {
    rawProperty: "Pour Point °C",
    rawUnit: null,
    specPropertyKey: "pour_point",
    confidence: MappingConfidence.HIGH,
  },

  // ── TBN / TAN — same unit, opposite quantities ────────────────────────────
  { rawProperty: "TBN", rawUnit: null, specPropertyKey: "tbn", confidence: MappingConfidence.HIGH },
  {
    rawProperty: "TBN MgKOH/g",
    rawUnit: null,
    specPropertyKey: "tbn",
    confidence: MappingConfidence.HIGH,
  },
  {
    rawProperty: "TBN, mg KOH/g",
    rawUnit: null,
    specPropertyKey: "tbn",
    confidence: MappingConfidence.HIGH,
  },
  {
    rawProperty: "Total Acid Number",
    rawUnit: null,
    specPropertyKey: "tan",
    confidence: MappingConfidence.HIGH,
  },

  // ── Volatility ────────────────────────────────────────────────────────────
  {
    rawProperty: "Noack",
    rawUnit: null,
    specPropertyKey: "noack_volatility",
    confidence: MappingConfidence.HIGH,
  },

  // ── CCS — one key, temperature carried as a qualifier ─────────────────────
  {
    rawProperty: "CCS @ -15ºC",
    rawUnit: null,
    specPropertyKey: "ccs_viscosity",
    confidence: MappingConfidence.HIGH,
    qualifier: "@ -15 °C",
  },
  {
    rawProperty: "CCS @ -20ºC",
    rawUnit: null,
    specPropertyKey: "ccs_viscosity",
    confidence: MappingConfidence.HIGH,
    qualifier: "@ -20 °C",
  },
  {
    rawProperty: "CCS @ -25ºC",
    rawUnit: null,
    specPropertyKey: "ccs_viscosity",
    confidence: MappingConfidence.HIGH,
    qualifier: "@ -25 °C",
  },
  {
    rawProperty: "CCS @ -30ºC",
    rawUnit: null,
    specPropertyKey: "ccs_viscosity",
    confidence: MappingConfidence.HIGH,
    qualifier: "@ -30 °C",
  },

  // ── Foaming — one printed cell, three properties ──────────────────────────
  {
    rawProperty: "Foaming Characteristics Seq. 1 @ 24ºC",
    rawUnit: null,
    specPropertyKey: "foaming_seq1_24c",
    confidence: MappingConfidence.HIGH,
  },
  {
    rawProperty: "Seq. 2 @ 93.5ºC",
    rawUnit: null,
    specPropertyKey: "foaming_seq2_93_5c",
    confidence: MappingConfidence.HIGH,
  },
  {
    rawProperty: "Seq. 3 @ 24ºC",
    rawUnit: null,
    specPropertyKey: "foaming_seq3_24c",
    confidence: MappingConfidence.HIGH,
  },

  // ── Corrosion ─────────────────────────────────────────────────────────────
  {
    rawProperty: "Copper Corrosion @ 100ºC",
    rawUnit: null,
    specPropertyKey: "copper_corrosion",
    confidence: MappingConfidence.HIGH,
    qualifier: "@ 100 °C",
  },
  {
    rawProperty: "Grease Copper Corrosion",
    rawUnit: null,
    specPropertyKey: "copper_corrosion",
    confidence: MappingConfidence.MEDIUM,
    note: "Grease uses ASTM D4048, oil uses D130. Same reported code, different test.",
  },

  // ── Turbine / compressor ──────────────────────────────────────────────────
  {
    rawProperty: "Air Release at 50°C",
    rawUnit: null,
    specPropertyKey: "air_release_50c",
    confidence: MappingConfidence.HIGH,
  },
  {
    rawProperty: "Water Demulsibility",
    rawUnit: null,
    specPropertyKey: null,
    confidence: MappingConfidence.LOW,
    note: "Source declares unit 'minutes' but prints the value 'Pass'; the printed method drops the D of ASTM D1401.",
  },
  {
    rawProperty: "Ball Weld Load-4",
    rawUnit: null,
    specPropertyKey: "four_ball_weld_load",
    confidence: MappingConfidence.HIGH,
  },
  {
    rawProperty: "Ball Weld Load -4",
    rawUnit: null,
    specPropertyKey: "four_ball_weld_load",
    confidence: MappingConfidence.HIGH,
  },

  // ── Descriptive ───────────────────────────────────────────────────────────
  {
    rawProperty: "Appearance",
    rawUnit: null,
    specPropertyKey: "appearance",
    confidence: MappingConfidence.HIGH,
  },
  {
    rawProperty: "Color",
    rawUnit: null,
    specPropertyKey: null,
    confidence: MappingConfidence.LOW,
    note: "May be a visual description; Addilex 'Color number' is an ASTM D1500 reading. Do not merge.",
  },
  {
    rawProperty: "Color number",
    rawUnit: null,
    specPropertyKey: null,
    confidence: MappingConfidence.LOW,
    note: "ASTM D1500 scale reading. Distinct from a colour description; needs sign-off.",
  },

  // ── Coolant ───────────────────────────────────────────────────────────────
  {
    rawProperty: "Reserve alkalinity",
    rawUnit: null,
    specPropertyKey: "coolant_reserve_alkalinity",
    confidence: MappingConfidence.HIGH,
    normalizedUnitOverride: "mL 0.100 N HCl",
    note: "ASTM D1121 defines the result as millilitres of 0.100 N HCl. The source prints only 'ml 0.1 N.' in this row and places 'HCL' in the following pH unit cell; raw cells remain unchanged.",
  },
  {
    rawProperty: "PH 33% Vol in water",
    rawUnit: null,
    specPropertyKey: "coolant_ph_33pct_water",
    confidence: MappingConfidence.HIGH,
    normalizedUnitOverride: null,
    note: "ASTM D1287 defines a pH reading, which is dimensionless. The source prints 'HCL' in the unit cell; raw cells remain unchanged and the normalized Specification carries no unit.",
  },
  {
    rawProperty: "pH value",
    rawUnit: null,
    specPropertyKey: null,
    confidence: MappingConfidence.MEDIUM,
    note: "Addilex pH, method 'annex A' — an unresolved internal reference.",
  },

  // ── Additive elemental content — element AND unit decide the fact ─────────
  {
    rawProperty: "Moisture",
    rawUnit: null,
    specPropertyKey: "moisture_water",
    confidence: MappingConfidence.HIGH,
  },
  {
    rawProperty: "Water",
    rawUnit: null,
    specPropertyKey: "moisture_water",
    confidence: MappingConfidence.HIGH,
  },
  {
    rawProperty: "Mechanical admixture",
    rawUnit: null,
    specPropertyKey: null,
    confidence: MappingConfidence.MEDIUM,
    note: "Measured by the in-house method AM-S90-009, not an ASTM method.",
  },
  {
    rawProperty: "Thermal decomposition temperature",
    rawUnit: null,
    specPropertyKey: null,
    confidence: MappingConfidence.MEDIUM,
    note: "Method is DTA, not an ASTM method.",
  },
  // ── Labels that carry the LIMIT DIRECTION in the label text ───────────────
  // `Flash point, no less than` is a minimum, but the direction is printed in the LABEL
  // while the value cell holds a bare number. Normalizing the value alone would record a
  // point value and lose the limit, so none of these resolves: reading the limit out of a
  // label is a decision about what the source meant, and that is a reviewer's to make.
  {
    rawProperty: "Flash point, no less than",
    rawUnit: null,
    specPropertyKey: null,
    confidence: MappingConfidence.MEDIUM,
    note:
      "Quantity is flash_point_oc, but the limit direction is in the label and the value " +
      "cell holds a bare number. Importing it as a point value would drop the limit.",
  },
  {
    rawProperty: "Moisture, no more than",
    rawUnit: null,
    specPropertyKey: null,
    confidence: MappingConfidence.MEDIUM,
    note: "Quantity is moisture_water; the maximum is stated in the label, not the value.",
  },
  {
    rawProperty: "Mechanical admixture, no more than",
    rawUnit: null,
    specPropertyKey: null,
    confidence: MappingConfidence.MEDIUM,
    note:
      "In-house method AM-S90-009, and the maximum is stated in the label rather than the " +
      "value.",
  },
  {
    rawProperty: "pH value, no less than",
    rawUnit: null,
    specPropertyKey: null,
    confidence: MappingConfidence.MEDIUM,
    note: "Addilex pH with the minimum in the label; method `annex A` is unresolved.",
  },
  {
    rawProperty: "Color number, no more than",
    rawUnit: null,
    specPropertyKey: null,
    confidence: MappingConfidence.LOW,
    note:
      "An ASTM D1500 scale reading with the maximum in the label — and the value printed " +
      "against it is a RANGE (`2-2.5`), which a maximum cannot be. Two defects at once.",
  },
  {
    rawProperty: "Chemical component",
    rawUnit: null,
    specPropertyKey: null,
    confidence: MappingConfidence.LOW,
    note: "Descriptive prose in a table, not a measurement. Should not become a Specification.",
  },
  {
    rawProperty: "Compatibility",
    rawUnit: null,
    specPropertyKey: null,
    confidence: MappingConfidence.LOW,
    note: "Descriptive prose in a table, not a measurement. Should not become a Specification.",
  },

  // ── Grease ────────────────────────────────────────────────────────────────
  {
    rawProperty: "Grease Worked penetration",
    rawUnit: null,
    specPropertyKey: "grease_penetration_worked",
    confidence: MappingConfidence.MEDIUM,
    note: "The HSB table prints no unit; 0.1 mm is the method's unit and is NOT filled in for the source.",
  },
  {
    rawProperty: "Drop Point",
    rawUnit: null,
    specPropertyKey: "drop_point",
    confidence: MappingConfidence.MEDIUM,
    note: "The HSB table prints no unit; °C is the method's unit and is NOT filled in for the source.",
  },
  {
    rawProperty: "Grease Free Alkali",
    rawUnit: null,
    specPropertyKey: "grease_free_alkali",
    confidence: MappingConfidence.MEDIUM,
    note: "The HSB table prints no unit.",
  },
] as const;

/** Elemental-content labels. Each element/unit pair is its own fact and none is HIGH yet. */
export const ELEMENT_CONTENT_LABELS: readonly string[] = [
  "Calcium",
  "Zinc",
  "Phosphorus",
  "Molybdenum",
  "Boron",
  "Nitrogen",
  "Nitrogen Content",
  "Sulfur",
  "Sulfur Content",
  "Magnesium",
];

function mappingLookupKey(rawProperty: string, rawUnit: string | null): string {
  return `${rawProperty.replace(/\s+/g, " ").trim().toLowerCase()}\u0000${(rawUnit ?? "").trim().toLowerCase()}`;
}

const MAPPINGS_BY_LABEL_AND_UNIT = new Map<string, SpecPropertyMappingSeed>();
const MAPPINGS_BY_LABEL = new Map<string, SpecPropertyMappingSeed>();
for (const mapping of SPEC_PROPERTY_MAPPINGS) {
  if (mapping.rawUnit === null) {
    MAPPINGS_BY_LABEL.set(mappingLookupKey(mapping.rawProperty, null), mapping);
  } else {
    MAPPINGS_BY_LABEL_AND_UNIT.set(mappingLookupKey(mapping.rawProperty, mapping.rawUnit), mapping);
  }
}

export type PropertyResolutionOutcome =
  "resolved" | "mapping-not-approved" | "element-content" | "unknown";

export interface PropertyResolution {
  readonly outcome: PropertyResolutionOutcome;
  /** Non-null only when `outcome === "resolved"`. */
  readonly propertyKey: string | null;
  readonly confidence: MappingConfidence | null;
  readonly qualifier: string | null;
  readonly note: string | null;
  readonly normalizedUnitOverride: string | null | undefined;
}

/**
 * Resolves a raw source label to a dictionary key, or explains why it did not.
 *
 * A unit-specific mapping wins over a unit-agnostic one, so a single label can mean two
 * facts. Only a HIGH mapping to a seeded key resolves; everything else is reported.
 */
export function resolveProperty(rawProperty: string, rawUnit: string): PropertyResolution {
  const specific = MAPPINGS_BY_LABEL_AND_UNIT.get(mappingLookupKey(rawProperty, rawUnit));
  const generic = MAPPINGS_BY_LABEL.get(mappingLookupKey(rawProperty, null));
  const mapping = specific ?? generic;

  if (!mapping) {
    const element = ELEMENT_CONTENT_LABELS.find(
      (label) => label.toLowerCase() === rawProperty.replace(/\s+/g, " ").trim().toLowerCase(),
    );
    if (element) {
      return {
        outcome: "element-content",
        propertyKey: null,
        confidence: MappingConfidence.MEDIUM,
        qualifier: null,
        note:
          `Elemental content (${element}). One element can appear as % and as ppm with two ` +
          `different methods, so it is modelled as element plus unit, not as one key per label.`,
        normalizedUnitOverride: undefined,
      };
    }
    return {
      outcome: "unknown",
      propertyKey: null,
      confidence: null,
      qualifier: null,
      note: null,
      normalizedUnitOverride: undefined,
    };
  }

  if (mapping.confidence === MappingConfidence.HIGH && mapping.specPropertyKey) {
    if (!SPEC_PROPERTY_KEYS.has(mapping.specPropertyKey)) {
      throw new Error(
        `Dictionary is inconsistent: mapping for "${mapping.rawProperty}" targets ` +
          `"${mapping.specPropertyKey}", which is not a seeded SpecProperty.`,
      );
    }
    return {
      outcome: "resolved",
      propertyKey: mapping.specPropertyKey,
      confidence: mapping.confidence,
      qualifier: mapping.qualifier ?? null,
      note: mapping.note ?? null,
      normalizedUnitOverride: mapping.normalizedUnitOverride,
    };
  }

  return {
    outcome: "mapping-not-approved",
    propertyKey: null,
    confidence: mapping.confidence,
    qualifier: mapping.qualifier ?? null,
    note: mapping.note ?? null,
    normalizedUnitOverride: mapping.normalizedUnitOverride,
  };
}
