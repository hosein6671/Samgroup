/**
 * The Localization resource client — `GET /api/v1/locales`, and the routing layer's only source
 * of truth for which locales exist.
 *
 * ── This module never falls back ────────────────────────────────────────────
 *
 * Every other fetch in this application fails open. `resolve-category-page.ts` renders a fixture
 * when the Category API is unreachable, and that is correct there: the fixture holds the approved
 * content, so a failed fetch costs the page nothing observable.
 *
 * This one is the opposite case, and the difference is worth stating precisely. There is no
 * fixture that could stand in for the locale table, because the locale table does not describe a
 * page's *content* — it determines which pages exist at all. A fallback here would not degrade a
 * page; it would generate a different site. Three specific fallbacks are ruled out by the approved
 * policy, and each has a distinct failure mode worth naming:
 *
 * - **`LOCALES` in `features/site/site-routes.ts`** — a switcher fixture whose shape is
 *   `{ code, label, native, ... }`, field-for-field different from the endpoint's
 *   `{ code, name, nativeName, ... }`. It is not a stale copy of the truth, it is a different
 *   thing that resembles it.
 * - **`["en"]`** — silently ships a single-locale site that looks entirely correct.
 * - **`[]`** — silently ships a site with zero pages, from a build that reported success.
 *
 * So every failure throws, and the build fails loudly. A red build costs one CI run; each of the
 * alternatives above costs a deployment nobody knows is wrong.
 *
 * ── Server-only, and what that means for middleware ─────────────────────────
 *
 * `import "server-only"` here, transitively through `api-client`, is what keeps the internal API
 * origin out of any browser bundle. `middleware.ts` deliberately does **not** import this module —
 * see its own note — and reads the same rules from `locale-contract`, which is transport-free and
 * runtime-agnostic precisely so that the rules are not written twice.
 */

import "server-only";

import { apiGet } from "./api-client";
import { LOCALES_PATH, findLocale, validateActiveLocales } from "./locale-contract";

import type { LocaleResponse } from "@sam-group/types";

/** A transport failure reaching the locale endpoint, as distinct from a bad payload. */
export class LocaleSourceError extends Error {
  constructor(detail: string) {
    super(`GET ${LOCALES_PATH} did not answer: ${detail}`);
    this.name = "LocaleSourceError";
  }
}

/**
 * The build-time memo.
 *
 * `generateStaticParams` and the `[locale]` root layout both need the list, and with three locales
 * the layout is rendered once per locale — so without this the same request would be issued four
 * times per build for a value that cannot change within one. `apiGet` stays `cache: "no-store"`;
 * this is a module-scope memo in front of it, not a change to the client's policy.
 *
 * **A rejection is memoized too, and that is intended.** If the locale source is unavailable, every
 * consumer in this build should fail with the same error rather than retrying and producing a
 * partially-generated tree from a source that answered inconsistently. The memo lives for the
 * lifetime of the module, which for a build is the lifetime of the build.
 */
let activeLocales: Promise<readonly LocaleResponse[]> | undefined;

async function load(): Promise<readonly LocaleResponse[]> {
  const result = await apiGet<unknown>(LOCALES_PATH);

  if (!result.ok) {
    if (result.reason === "unreachable") {
      // `detail` is a syscall code or an error name — never anything derived from the URL, so this
      // is safe to print. It is the difference between "you forgot API_INTERNAL_URL" and "the API
      // is down", which is the first thing anyone reading a failed build needs to know.
      throw new LocaleSourceError(
        `${result.detail} (is API_INTERNAL_URL set, and is the API running?)`,
      );
    }

    if (result.reason === "http") {
      throw new LocaleSourceError(`HTTP ${String(result.status)}`);
    }

    throw new LocaleSourceError(
      `HTTP ${String(result.status)} carried a body that is not the { data, meta } envelope`,
    );
  }

  // Throws LocaleContractError on anything it cannot vouch for. Not caught here: the whole point
  // is that it reaches the build.
  return validateActiveLocales(result.data);
}

/**
 * Every active locale, in the endpoint's own order.
 *
 * @throws LocaleSourceError if the endpoint could not be reached or did not answer with the
 *   envelope, and LocaleContractError if it answered with a set that cannot be a routing source.
 *   Both are fatal by design — see the module note.
 */
export function getActiveLocales(): Promise<readonly LocaleResponse[]> {
  activeLocales ??= load();

  return activeLocales;
}

/**
 * One locale record by its code, from the authoritative list.
 *
 * `undefined` rather than a throw for an unknown code: the caller is the root layout, and what an
 * unrecognised route segment means is a routing decision that belongs there. In practice
 * `dynamicParams = false` means an unknown segment never reaches it.
 */
export async function getLocaleByCode(code: string): Promise<LocaleResponse | undefined> {
  return findLocale(await getActiveLocales(), code);
}
