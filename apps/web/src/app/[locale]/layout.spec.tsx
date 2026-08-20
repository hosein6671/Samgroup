import { beforeEach, describe, expect, it, vi } from "vitest";

import { findTags } from "@test/element-tree";

import LocaleLayout from "./layout";

/**
 * The document's language identity — `<html lang>` and `<html dir>`.
 *
 * ## Why this has a spec of its own
 *
 * Because it is the thing a CMS locale fallback must never be allowed to move. Payload serves the
 * default locale's values for a page nobody has translated, and the API reports that as
 * `meta.localeFallback`. It would be an easy and wrong reflex to follow the content and relabel the
 * document — a visitor on `/ar/about-us` would then be served a page claiming to be English, with
 * the direction to match, because an editor had not finished translating it.
 *
 * The route segment is the authority. `lang`/`dir` come from the `Locale` **table row for the route
 * locale** and from nothing else: not from the content, not from the API response, not from a
 * fallback flag. This file is what fails if that ever changes.
 *
 * The corresponding half — that a page annotates the fallback *content* with the locale actually
 * served — is asserted in `about-us/page.spec.tsx`.
 */

const { getLocaleByCode } = vi.hoisted(() => ({ getLocaleByCode: vi.fn() }));

vi.mock("@/lib/locales", () => ({ getLocaleByCode, getActiveLocales: vi.fn() }));
vi.mock("../fonts", () => ({ FONT_VARIABLES: "" }));
vi.mock("../globals.css", () => ({}));

class NotFoundSignal extends Error {}

vi.mock("next/navigation", () => ({
  notFound: (): never => {
    throw new NotFoundSignal();
  },
}));

const ROWS = {
  en: { code: "en", name: "English", nativeName: "English", direction: "ltr", isDefault: true },
  fa: { code: "fa", name: "Persian", nativeName: "Farsi", direction: "rtl", isDefault: false },
  ar: { code: "ar", name: "Arabic", nativeName: "Arabic", direction: "rtl", isDefault: false },
};

async function renderAt(locale: keyof typeof ROWS): Promise<{ lang: unknown; dir: unknown }> {
  getLocaleByCode.mockResolvedValue(ROWS[locale]);

  const tree = await LocaleLayout({
    children: null,
    params: Promise.resolve({ locale }),
  });

  const html = findTags(tree, "html")[0];

  return { lang: html?.props.lang, dir: html?.props.dir };
}

describe("the document locale is the route's", () => {
  beforeEach(() => {
    getLocaleByCode.mockClear();
  });

  it("/en → lang=en, dir=ltr", async () => {
    await expect(renderAt("en")).resolves.toEqual({ lang: "en", dir: "ltr" });
  });

  it("/fa → lang=fa, dir=rtl", async () => {
    await expect(renderAt("fa")).resolves.toEqual({ lang: "fa", dir: "rtl" });
  });

  it("/ar → lang=ar, dir=rtl", async () => {
    await expect(renderAt("ar")).resolves.toEqual({ lang: "ar", dir: "rtl" });
  });

  it("reads direction from the Locale row rather than inferring it from the code", async () => {
    // A hypothetical ltr Arabic row would render ltr: the table is the authority, not the code.
    getLocaleByCode.mockResolvedValue({ ...ROWS.ar, direction: "ltr" });

    const tree = await LocaleLayout({ children: null, params: Promise.resolve({ locale: "ar" }) });

    expect(findTags(tree, "html")[0]?.props.dir).toBe("ltr");
  });

  it("asks only for the route's locale, so nothing else can influence the document", async () => {
    await renderAt("ar");

    expect(getLocaleByCode).toHaveBeenCalledTimes(1);
    expect(getLocaleByCode).toHaveBeenCalledWith("ar");
  });
});
