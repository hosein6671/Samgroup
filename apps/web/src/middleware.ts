import { NextResponse } from "next/server";

import { ROUTES } from "@/features/site/site-routes";
import { apiGet } from "@/lib/api-client";
import {
  LOCALES_PATH,
  LOCALE_COOKIE,
  negotiateLocale,
  validateActiveLocales,
} from "@/lib/locale-contract";

import type { NextRequest } from "next/server";

/**
 * Locale detection and redirect. That is the whole of it.
 *
 * FRONTEND_ARCHITECTURE §2 describes three eventual concerns in a fixed order — admin
 * short-circuit, locale detection, then the `Redirect` table lookup. Only the middle one is
 * implemented: there is no admin surface yet and no `Redirect` row exists, so the other two arrive
 * with the gates that create what they protect. `next-intl` is deferred and not installed; this is
 * native App Router routing.
 *
 * ── It classifies paths, it does not recognise locales ──────────────────────
 *
 * The ordered policy is deliberately blind:
 *
 *   1. `/design-proof/**`            → bypass entirely
 *   2. `/`                           → redirect candidate
 *   3. known locale-less structural  → redirect candidate
 *   4. everything else               → pass through, untouched
 *
 * Rule 4 is the important one. `/en/products` and `/xx/products` and `/foo` all take it, and the
 * router decides: `/en` matches `[locale]` and renders, while `/xx` and `/foo` match nothing and
 * 404 because `dynamicParams = false` closes the segment to the generated set. So this file needs
 * no notion of what a locale code looks like — no two-letter regex, no BCP-47 parsing, no
 * inspection of the active list to classify. That is not a shortcut; a shape test would buy
 * nothing (both branches 404 identically) and would misfire the day a structural page is added
 * whose first segment happens to be two letters.
 *
 * The consequence is that **the locale API is queried only on a redirect candidate** — `/` and the
 * handful of known structural paths — never on the general traffic that takes rule 4.
 *
 * ── Why this does not import `lib/locales` ──────────────────────────────────
 *
 * That module is `server-only` and memoized for the lifetime of the process, which is exactly
 * right for a build and exactly wrong here: a long-lived worker would pin the first locale list it
 * ever saw. This file re-reads per redirect candidate instead.
 *
 * It reuses everything else rather than restating it — `apiGet` for transport,
 * `validateActiveLocales` for the contract, `negotiateLocale` for the preference order. Those
 * rules exist once, in `locale-contract`, which is transport-free and free of Node-only APIs so
 * that both consumers can share it. Nothing about locale validation or negotiation is written
 * twice.
 *
 * ── It never invents a locale ───────────────────────────────────────────────
 *
 * If the locale API cannot supply a valid active set, this does not guess, does not fall back to a
 * hardcoded default, and does not redirect. The request passes through unchanged and normal route
 * handling answers it — a 404 for a path with no locale prefix. An infrastructure failure is
 * allowed to look like a failure; it is never allowed to mint a locale that did not come from
 * `GET /locales`.
 */

/**
 * The first path segments that are canonical structural routes, derived from `ROUTES` rather than
 * retyped.
 *
 * Retyping the list here would be a second copy of the site's route vocabulary, and the two would
 * drift the first time a page is added. Deriving it means adding a route to `site-routes.ts`
 * automatically makes it redirect-eligible, which is the coupling we want.
 *
 * Two details the reduction has to get right:
 *
 * - **Fragment values are excluded.** `ROUTES.documentation` is `/products#documentation`, an
 *   in-page anchor rather than a routable path. Its first segment happens to be `products`, which
 *   is already in the set, but filtering on `#` is what makes that a fact rather than a
 *   coincidence.
 * - **First segment only.** `/contact-us/request-a-quote` reduces to `contact-us`, and every
 *   `/products/{slug}` to `products`. So `PRODUCT_CATEGORIES` needs no separate enumeration —
 *   `products` is already a structural namespace — and neither will the future Product Detail
 *   route.
 *
 * `ROUTES.home` is `/`, whose first segment is empty; it is filtered out here and handled as its
 * own rule below.
 */
const STRUCTURAL_SEGMENTS: ReadonlySet<string> = new Set(
  Object.values(ROUTES)
    .filter((route) => !route.includes("#"))
    .map((route) => route.split("/")[1] ?? "")
    .filter((segment) => segment !== ""),
);

/** The proof tree, which bypasses every rule below it. */
const PROOF_PREFIX = "/design-proof";

/**
 * The active locale set for one request, or `null` when it cannot be established.
 *
 * `null` rather than a throw: a middleware that throws produces a 500, and an unreachable locale
 * API is not a reason to take down a page. The caller passes the request through instead.
 */
async function loadActiveLocales(): Promise<Awaited<
  ReturnType<typeof validateActiveLocales>
> | null> {
  const result = await apiGet<unknown>(LOCALES_PATH);

  if (!result.ok) {
    console.warn(`[middleware] no locale redirect — GET ${LOCALES_PATH} failed (${result.reason})`);

    return null;
  }

  try {
    return validateActiveLocales(result.data);
  } catch (error: unknown) {
    // The contract error's own message names the violation; nothing from the payload is echoed.
    console.warn(
      `[middleware] no locale redirect — ${error instanceof Error ? error.message : "unusable locale set"}`,
    );

    return null;
  }
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // 1. The proof tree is not locale-routed and never will be. Checked before anything else so no
  //    later rule can reach it.
  if (pathname === PROOF_PREFIX || pathname.startsWith(`${PROOF_PREFIX}/`)) {
    return NextResponse.next();
  }

  const firstSegment = pathname.split("/")[1] ?? "";

  // 2 and 3. The only two shapes that get a locale prefix added.
  const isRedirectCandidate = pathname === "/" || STRUCTURAL_SEGMENTS.has(firstSegment);

  // 4. Everything else — including `/en/...`, `/xx/...` and `/foo` — is the router's business.
  if (!isRedirectCandidate) {
    return NextResponse.next();
  }

  const locales = await loadActiveLocales();

  if (locales === null) {
    return NextResponse.next();
  }

  const locale = negotiateLocale(
    locales,
    request.cookies.get(LOCALE_COOKIE)?.value,
    request.headers.get("accept-language"),
  );

  const url = request.nextUrl.clone();

  // `/` becomes `/en`, not `/en/` — a trailing slash would be a second URL for one page.
  url.pathname = pathname === "/" ? `/${locale.code}` : `/${locale.code}${pathname}`;

  // 307, not 308: the target depends on a cookie and a header, so it is negotiated per request and
  // must not be cached by a browser as a permanent mapping.
  return NextResponse.redirect(url, 307);
}

/**
 * What the middleware runs on.
 *
 * Excluded: `_next` (build output, including `next/font`'s self-hosted files under
 * `_next/static/media`), `api` — which no Next route handler serves today, but which nginx proxies
 * to `apps/api` in production — and any path containing a dot, which covers `favicon.ico`,
 * `robots.txt`, `sitemap.xml` and everything a future `public/` directory would hold, without this
 * matcher needing an edit when one appears.
 *
 * `/design-proof` is deliberately **not** excluded here. Its bypass is rule 1 in the function
 * above, where it is visible and testable, rather than folded into a regex.
 */
export const config = {
  matcher: ["/((?!api|_next|.*\\.).*)"],
};
