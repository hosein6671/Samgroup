import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { uiCatalog } from "@/i18n/catalogs";
import { translator } from "@/i18n/translate";

import { SPEC_PROPERTY_LABELS, propertyLabel } from "./property-labels";

/** The dictionary keys, read from the API's own seed so the two lists cannot drift apart. */
const DICTIONARY_KEYS = [
  ...readFileSync(
    join(
      __dirname,
      "..",
      "..",
      "..",
      "..",
      "..",
      "api",
      "src",
      "modules",
      "catalog",
      "import",
      "spec-property-dictionary.ts",
    ),
    "utf8",
  )
    .split("export const SPEC_PROPERTY_SEED")[1]!
    .split("];")[0]!
    .matchAll(/key: "([a-z0-9_]+)"/g),
].map((match) => match[1]!);

describe("specification property labels", () => {
  it("names every key in the controlled property dictionary", () => {
    expect(DICTIONARY_KEYS.length).toBeGreaterThan(20);
    expect(DICTIONARY_KEYS.filter((key) => !Object.hasOwn(SPEC_PROPERTY_LABELS, key))).toEqual([]);
  });

  it("has a Persian name for every labelled key", () => {
    const fa = uiCatalog("fa");
    expect(Object.keys(SPEC_PROPERTY_LABELS).filter((key) => !Object.hasOwn(fa, key))).toEqual([]);
  });

  it("reads the English name in the default locale", () => {
    expect(propertyLabel("kv_40c", translator("en"))).toBe("Kinematic viscosity at 40 °C");
    expect(propertyLabel("ccs_viscosity", translator("en"))).toBe("Cold-cranking viscosity (CCS)");
  });

  it("reads the Persian name in Persian", () => {
    expect(propertyLabel("kv_40c", translator("fa"))).toBe(uiCatalog("fa")["kv_40c"]);
  });

  it("prints an unknown key verbatim rather than guessing", () => {
    expect(propertyLabel("Viscosity, 40°C", translator("en"))).toBe("Viscosity, 40°C");
    expect(propertyLabel("not_in_dictionary", translator("fa"))).toBe("not_in_dictionary");
  });
});
