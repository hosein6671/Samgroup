/**
 * Payload's localization configuration — **frozen in code, not configurable.**
 *
 * ── Why this is code and not environment ────────────────────────────────────
 *
 * The Phase 1 locale set is already frozen: `en` (default), `fa` and `ar`, all three shipping
 * together rather than phased ([AI_CONTEXT.md](../../../AI_CONTEXT.md) i18n thread,
 * [ROADMAP.md](../../../docs/ROADMAP.md) M1). An earlier revision of this scaffold read the set from
 * `CMS_LOCALES`/`CMS_DEFAULT_LOCALE`, which made a frozen decision silently overridable per
 * environment — one deployment could serve a locale set the platform does not have, or miss one it
 * does, with nothing anywhere reporting the divergence. That is the drift this file removes.
 *
 * The authority for which locales are *active* on the platform is the `Locale` table in
 * `sam_platform`, which ADR-002 forbids Payload from opening. This file does not attempt to reach
 * it, and by decision the alternatives were rejected as well: **no `sam_platform` connection from
 * Payload, no boot-time `cms` → `api` dependency** (today `api` calls `cms` and never the reverse),
 * **and no reconciliation service**. For Phase 1 the two lists agree because both are frozen to the
 * same three codes, and that agreement is asserted below rather than assumed.
 *
 * **Adding a locale is deliberately a code change**, and an intentional architecture/config step —
 * it is a change here, a `Locale` row, a `sam_cms` schema change (Payload's Postgres adapter stores
 * localized values per locale), and translated content. PROJECT_HANDOFF.md §6.9's "adding a
 * language must never require a code change" is a statement about the platform's *routing* layer,
 * which reads the `Locale` table and still holds no locale literal; Payload's own configuration is
 * not that layer, and pretending otherwise is what produced the drift.
 */

/**
 * The frozen Phase 1 locale codes, in the order the platform lists them.
 *
 * `as const` is load-bearing: it makes the tuple's contents part of the type, which is what lets the
 * assertions at the bottom of this file fail `pnpm type-check` — not merely a runtime check — if
 * anyone edits this list without doing the rest of the work above.
 */
export const CMS_LOCALE_CODES = ["en", "fa", "ar"] as const;

export type CmsLocaleCode = (typeof CMS_LOCALE_CODES)[number];

export const CMS_DEFAULT_LOCALE = "en" as const;

/**
 * `fallback: true` — an untranslated field serves the default locale's value rather than rendering
 * empty ([INTERNATIONALIZATION_STRATEGY.md](../../../docs/i18n/INTERNATIONALIZATION_STRATEGY.md) §3),
 * and the NestJS Content module reports it as `meta.localeFallback`
 * ([API_CONTRACT_FINAL.md](../../../docs/API_CONTRACT_FINAL.md) §3). Both documents depend on it, so
 * it is not a switch.
 */
export const CMS_LOCALIZATION = {
  locales: [...CMS_LOCALE_CODES],
  defaultLocale: CMS_DEFAULT_LOCALE,
  fallback: true,
} as const;

/* ------------------------------------------------------- drift assertions */

/**
 * Compile-time guards. These are not decoration: `pnpm type-check` runs in CI, so a change to the
 * frozen set that does not also update this file is a red build rather than a surprise in a
 * deployment.
 */
type Assert<T extends true> = T;
type Equals<A, B> =
  (<G>() => G extends A ? 1 : 2) extends <G>() => G extends B ? 1 : 2 ? true : false;

/** The locale set is exactly `en`, `fa`, `ar` — no more, no fewer, in this order. */
type _FrozenSet = Assert<Equals<typeof CMS_LOCALE_CODES, readonly ["en", "fa", "ar"]>>;

/** The default is `en`, and is a member of the set. */
type _FrozenDefault = Assert<Equals<typeof CMS_DEFAULT_LOCALE, "en">>;
type _DefaultIsMember = Assert<typeof CMS_DEFAULT_LOCALE extends CmsLocaleCode ? true : false>;

/** Fallback is on, and is the literal `true` rather than a widened boolean. */
type _FallbackOn = Assert<Equals<(typeof CMS_LOCALIZATION)["fallback"], true>>;

/**
 * Runtime guard, for the one thing the type system cannot catch: a build that somehow loads a
 * different module. Cheap, runs once at config-build time, and fails the process rather than
 * silently serving the wrong locale set.
 */
export function assertFrozenLocalization(): void {
  const expected = ["en", "fa", "ar"];
  const actual = CMS_LOCALIZATION.locales;

  if (actual.length !== expected.length || expected.some((code, i) => actual[i] !== code)) {
    throw new Error(
      `Payload locale set is frozen to ${expected.join(", ")} for Phase 1 but resolved to ${actual.join(", ")}.`,
    );
  }

  if (CMS_LOCALIZATION.defaultLocale !== "en") {
    throw new Error("Payload default locale is frozen to en for Phase 1.");
  }

  if (CMS_LOCALIZATION.fallback !== true) {
    throw new Error("Payload locale fallback is required by INTERNATIONALIZATION_STRATEGY.md §3.");
  }
}
