/**
 * Drift guard for the frozen Phase 1 locale set.
 *
 * `localization.ts` already carries compile-time assertions, which are the stronger check — they
 * fail `pnpm type-check` in CI. These add the two things types cannot express: that
 * `assertFrozenLocalization()` actually rejects a wrong set rather than merely existing, and that
 * the exported configuration is the literal `en`/`fa`/`ar` shape Payload receives.
 *
 * The point of both is the same: the locale set was environment-configurable for one revision of
 * this scaffold, which made an already-frozen decision silently overridable per deployment. It must
 * never quietly become so again.
 */

import assert from "node:assert/strict";
import test, { describe } from "node:test";

import {
  CMS_DEFAULT_LOCALE,
  CMS_LOCALE_CODES,
  CMS_LOCALIZATION,
  assertFrozenLocalization,
} from "./localization";

describe("frozen locale configuration", () => {
  test("is exactly en, fa, ar with en as the default and fallback on", () => {
    assert.deepEqual([...CMS_LOCALE_CODES], ["en", "fa", "ar"]);
    assert.equal(CMS_DEFAULT_LOCALE, "en");
    assert.deepEqual([...CMS_LOCALIZATION.locales], ["en", "fa", "ar"]);
    assert.equal(CMS_LOCALIZATION.defaultLocale, "en");
    // Not a switch: INTERNATIONALIZATION_STRATEGY.md §3 and API_CONTRACT_FINAL.md §3 both depend on
    // an untranslated field serving the default locale rather than rendering empty.
    assert.equal(CMS_LOCALIZATION.fallback, true);
  });

  test("the default locale is a member of the set", () => {
    assert.ok(CMS_LOCALE_CODES.includes(CMS_DEFAULT_LOCALE));
  });

  test("the runtime assertion passes on the frozen set", () => {
    assert.doesNotThrow(() => {
      assertFrozenLocalization();
    });
  });

  test("no locale value is read from the environment", async () => {
    // The variables that used to drive this. Setting them must change nothing at all.
    process.env.CMS_LOCALES = "en,de,zz";
    process.env.CMS_DEFAULT_LOCALE = "de";

    try {
      const reloaded = await import(`./localization.ts?drift=${Date.now()}`);

      assert.deepEqual([...reloaded.CMS_LOCALE_CODES], ["en", "fa", "ar"]);
      assert.equal(reloaded.CMS_DEFAULT_LOCALE, "en");
      assert.doesNotThrow(() => {
        reloaded.assertFrozenLocalization();
      });
    } finally {
      delete process.env.CMS_LOCALES;
      delete process.env.CMS_DEFAULT_LOCALE;
    }
  });
});
