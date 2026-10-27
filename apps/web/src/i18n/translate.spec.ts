import { describe, expect, it } from "vitest";

import { localizeContent } from "./localize-content";
import { formatCount, translator, translatorFrom } from "./translate";

describe("translator", () => {
  it("returns the English source for English and for a locale with no catalog", () => {
    expect(translator("en")("Close menu")).toBe("Close menu");
    expect(translator("xx")("Close menu")).toBe("Close menu");
  });

  it("translates through the locale's UI catalog", () => {
    expect(translator("fa")("Close menu")).toBe("بستن منو");
  });

  it("falls back to the English source for a missing entry", () => {
    expect(translator("fa")("A sentence no catalog has")).toBe("A sentence no catalog has");
  });

  it("fills {placeholders} in the translation, and leaves unknown ones visible", () => {
    const t = translatorFrom({ "Page {page} of {last}": "صفحه‌ی {page} از {last}" });
    expect(t("Page {page} of {last}", { page: "۲", last: "۵" })).toBe("صفحه‌ی ۲ از ۵");
    expect(t("Hello {name}")).toBe("Hello {name}");
  });
});

describe("formatCount", () => {
  it("writes a count in the locale's own digits", () => {
    expect(formatCount("en", 2026)).toBe("2026");
    expect(formatCount("fa", 2026)).toBe("۲۰۲۶");
  });
});

describe("localizeContent", () => {
  it("returns English built-in copy unchanged", () => {
    const value = { title: "Close menu" };
    expect(localizeContent("en", value)).toEqual(value);
  });

  it("translates display text and never machine vocabulary", () => {
    const value = {
      label: "Covering",
      value: "Engine room and deck",
      href: "/products",
      kind: "Open",
      access: "open",
      grade: "SN 150",
      items: ["Viscosity index", "SAE 10W-40"],
    };
    expect(localizeContent("fa", value)).toEqual({
      label: "شامل",
      value: "موتورخانه و عرشه",
      href: "/products",
      kind: "Open",
      access: "open",
      grade: "SN 150",
      items: ["شاخص گرانروی", "SAE 10W-40"],
    });
  });

  it("matches whole strings only, never substrings", () => {
    expect(localizeContent("fa", { text: "Viscosity index above 120" })).toEqual({
      text: "Viscosity index above 120",
    });
  });
});
