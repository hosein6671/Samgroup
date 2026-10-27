import type { Translate } from "@/i18n/translate";

/**
 * Readable names for the controlled specification-property keys.
 *
 * The keys are the `spec_properties` dictionary (`SPEC_PROPERTY_SEED` in
 * `apps/api/src/modules/catalog/import/spec-property-dictionary.ts`) — approved domain vocabulary,
 * not product data. Each English name restates that dictionary entry's `canonicalMeaning` in the
 * wording of the ASTM/ISO test it reports, so a buyer reads "Kinematic viscosity at 40 °C" rather
 * than `kv_40c`. Nothing about any product's value, unit or method is inferred here.
 *
 * Persian names live in `messages/fa.json`, keyed by the raw property key — the shape that catalog
 * already uses — so a locale catalog stays the single place a translated label is kept.
 */
export const SPEC_PROPERTY_LABELS: Readonly<Record<string, string>> = {
  kv_100c: "Kinematic viscosity at 100 °C",
  kv_40c: "Kinematic viscosity at 40 °C",
  kv_100c_after_shear_30cyc: "Kinematic viscosity at 100 °C after shear (30 cycles)",
  viscosity_loss_shear: "Viscosity loss after shear",
  viscosity_index: "Viscosity index",
  specific_gravity: "Specific gravity",
  density_15c: "Density at 15 °C",
  density_20c: "Density at 20 °C",
  flash_point_oc: "Flash point (open cup)",
  flash_point_coc: "Flash point (Cleveland open cup)",
  pour_point: "Pour point",
  tbn: "Total base number (TBN)",
  tan: "Total acid number (TAN)",
  noack_volatility: "Noack volatility",
  ccs_viscosity: "Cold-cranking viscosity (CCS)",
  foaming_seq1_24c: "Foaming, Sequence I (24 °C)",
  foaming_seq2_93_5c: "Foaming, Sequence II (93.5 °C)",
  foaming_seq3_24c: "Foaming, Sequence III (24 °C after 93.5 °C)",
  copper_corrosion: "Copper strip corrosion",
  air_release_50c: "Air release at 50 °C",
  four_ball_weld_load: "Four-ball weld load",
  appearance: "Appearance",
  moisture_water: "Water content",
  grease_penetration_worked: "Worked penetration",
  drop_point: "Dropping point",
  grease_free_alkali: "Free alkali",
  coolant_reserve_alkalinity: "Reserve alkalinity",
  coolant_ph_33pct_water: "pH (33 % by volume in water)",
};

/**
 * The name a specification row is shown under, in the page's language.
 *
 * The locale catalog wins when it has the key (Persian today). Otherwise the English name above is
 * used, and a key outside the dictionary is printed exactly as it arrived — never guessed at.
 */
export function propertyLabel(key: string, t: Translate): string {
  const translated = t(key);
  if (translated !== key) return translated;
  return Object.hasOwn(SPEC_PROPERTY_LABELS, key) ? (SPEC_PROPERTY_LABELS[key] ?? key) : key;
}
