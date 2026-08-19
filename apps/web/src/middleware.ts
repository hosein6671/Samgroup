import { NextResponse } from "next/server";

import { LOGIN_PATH, SESSION_END_PATH, isAdminSurfacePath } from "@/features/admin/admin-routes";
import { refresh } from "@/features/admin/session/auth-api";
import {
  ACCESS_COOKIE,
  AUTH_COOKIES,
  CLEARED_VALUE,
  REFRESH_COOKIE,
  accessCookieOptions,
  clearedCookieOptions,
  refreshCookieOptions,
} from "@/features/admin/session/cookie-contract";
import {
  SESSION_SIGNAL_HEADER,
  SESSION_SIGNAL_UNAVAILABLE,
} from "@/features/admin/session/session-signal";
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
 * The Admin session check, then locale detection and redirect.
 *
 * FRONTEND_ARCHITECTURE §2 describes three eventual concerns in a fixed order — admin
 * short-circuit, locale detection, then the `Redirect` table lookup. **The first two are now
 * implemented**; the third arrives with the gate that creates the first `Redirect` row.
 * `next-intl` is deferred and not installed; this is native App Router routing.
 *
 * The ordering §2 specifies is load-bearing rather than stylistic: running locale resolution on an
 * admin path would rewrite `/admin` to `/en/admin` before the session check ever saw it, and the
 * Admin surface is deliberately outside `[locale]`.
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

/* ==========================================================================
   THE ADMIN SESSION CHECK
   ========================================================================== */

/**
 * The request headers a protected Admin render should see, rebuilt from this request.
 *
 * ── Why a full clone rather than a mutation ─────────────────────────────────
 *
 * `NextResponse.next({ request: { headers } })` serializes each header as `x-middleware-request-*`
 * plus an `x-middleware-override-headers` list, and the server then **deletes every request header
 * whose name is not in that list** (`next/dist/server/lib/router-utils/resolve-routes.js`). A
 * partial set would therefore strip `accept`, `user-agent`, `accept-language` and everything else
 * from the render. `new Headers(request.headers)` copies the lot, and a fresh `Headers` is
 * unguarded, so setting `cookie` on it cannot fail the way mutating an incoming request's headers
 * might.
 *
 * ── The inbound session signal is always removed ────────────────────────────
 *
 * Whatever `x-sam-admin-session` a client sent is dropped here, and only this function puts one
 * back. Forging it grants nothing (see `session-signal.ts` — it is read only when no access cookie
 * exists, and it can only downgrade a login redirect into an "unavailable" page), but a header the
 * render trusts should have exactly one author.
 */
function adminRequestHeaders(request: NextRequest): Headers {
  const headers = new Headers(request.headers);

  headers.delete(SESSION_SIGNAL_HEADER);

  return headers;
}

/**
 * The same headers, with the browser's `Cookie` rewritten so this request's render observes a
 * freshly rotated access token.
 *
 * This is the "same-request propagation" half of rotation. `response.cookies.set` tells the
 * *browser* about the new token, which only helps the next request; without this the render that
 * triggered the refresh would still see the old (absent) cookie and conclude nobody was signed in.
 *
 * The cookie header is reassembled from `request.cookies.getAll()` rather than string-patched, so
 * an existing `sam_admin_access` is replaced rather than duplicated — two cookies of one name in
 * one header is ambiguous and the parser that wins is not ours to choose. Values are joined
 * unencoded, exactly as Next's own `stringifyCookie` does; a base64url refresh token and a JWT both
 * consist entirely of cookie-safe characters.
 */
function adminRequestHeadersWithAccess(request: NextRequest, accessToken: string): Headers {
  const headers = adminRequestHeaders(request);
  const jar = new Map(request.cookies.getAll().map((cookie) => [cookie.name, cookie.value]));

  jar.set(ACCESS_COOKIE, accessToken);
  headers.set("cookie", [...jar].map(([name, value]) => `${name}=${value}`).join("; "));

  return headers;
}

/** `/login`, as an absolute URL on this origin. Never derived from a parameter — see §Redirect safety. */
function loginRedirect(request: NextRequest): NextResponse {
  // 307, not 308: whether an Admin path needs a login is decided per request, and a browser must
  // never cache it as a permanent mapping.
  return NextResponse.redirect(new URL(LOGIN_PATH, request.nextUrl), 307);
}

/** Expire both auth cookies on a response, with the exact options they were issued under. */
function clearAuthCookies(response: NextResponse): void {
  const options = clearedCookieOptions();

  for (const name of AUTH_COOKIES) {
    response.cookies.set(name, CLEARED_VALUE, options);
  }
}

/**
 * The Admin surface's session check — concern 1 of §2, and the only place refresh rotation happens.
 *
 * ── Why rotation lives in middleware ────────────────────────────────────────
 *
 * Next 15 rejects `cookies().set()` outside the action phase, so a Server Component cannot persist
 * a rotated refresh token. Since `POST /auth/refresh` revokes the presented session in the same
 * transaction that mints its replacement (ADR-012), refreshing from a render would destroy the
 * browser's only credential and be unable to store what replaced it. Middleware can set cookies on
 * its response, so this is where it belongs.
 *
 * ── At most one refresh per browser request, structurally ───────────────────
 *
 * Middleware runs once per incoming request, so there is no in-render lock, no memoization and no
 * shared store to get wrong. The API is independently race-safe — concurrent use of one refresh
 * token yields exactly one winner and one generic 401 — but a race this tier avoids is a race whose
 * loser is not a signed-in operator being bounced to the login page.
 *
 * The access cookie's `Max-Age` is aligned to the token's 15-minute TTL, so the browser dropping it
 * *is* expiry: a present cookie means "not yet expired" and no refresh is attempted. **No JWT is
 * decoded anywhere on this path** — there is nothing to decode that would be trusted.
 *
 * ── The four outcomes ───────────────────────────────────────────────────────
 *
 * 1. Access cookie present → continue. Whether the token is still *accepted* is `GET /auth/me`'s
 *    answer during the render, not a guess made here.
 * 2. No access, no refresh → `/login`. Nothing to clear.
 * 3. Refresh **rejected** (401/403) → auth truth. Clear both cookies, go to `/login`.
 * 4. Refresh **unavailable** (network, timeout, 5xx, non-envelope) → the credential is not at
 *    fault. Keep both cookies untouched, flag the request, and let the page render a neutral
 *    unavailable state. This is the branch that must never become a login redirect.
 */
async function resolveAdminRequest(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  /*
   * `/login` must stay reachable without a session — it is where every other branch sends people —
   * and the credential-clearing handler must stay reachable *with* a broken one, which is its whole
   * purpose. Neither triggers a refresh: rotating a token one hop before deliberately discarding it
   * would be pure waste.
   *
   * An already-authenticated visitor to `/login` is left alone rather than bounced to `/admin`.
   * Deciding that here would mean either trusting a decoded claim (forbidden) or spending a
   * `GET /auth/me` on every login page view to answer a question nobody asked.
   */
  if (pathname === LOGIN_PATH || pathname === SESSION_END_PATH) {
    return NextResponse.next({ request: { headers: adminRequestHeaders(request) } });
  }

  if (request.cookies.get(ACCESS_COOKIE)?.value) {
    return NextResponse.next({ request: { headers: adminRequestHeaders(request) } });
  }

  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

  if (refreshToken === undefined || refreshToken === "") {
    return loginRedirect(request);
  }

  const attempt = await refresh(refreshToken);

  if (attempt.outcome === "rejected") {
    const response = loginRedirect(request);

    clearAuthCookies(response);

    return response;
  }

  if (attempt.outcome !== "ok") {
    /*
     * `unavailable` and the unreachable-in-practice `throttled` share this branch. Both mean the
     * platform did not answer the question, and neither is grounds for deleting a seven-day
     * credential that may be perfectly good.
     */
    const headers = adminRequestHeaders(request);

    headers.set(SESSION_SIGNAL_HEADER, SESSION_SIGNAL_UNAVAILABLE);

    return NextResponse.next({ request: { headers } });
  }

  const { accessToken, refreshToken: rotated } = attempt.value;

  const response = NextResponse.next({
    request: { headers: adminRequestHeadersWithAccess(request, accessToken) },
  });

  // The browser's copy. The rotated refresh token MUST be stored — the one presented above is
  // already revoked, so failing to write this would end the session on the next request.
  response.cookies.set(ACCESS_COOKIE, accessToken, accessCookieOptions());
  response.cookies.set(REFRESH_COOKIE, rotated, refreshCookieOptions());

  return response;
}

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

  // 0. The Admin surface short-circuits first, exactly as FRONTEND_ARCHITECTURE §2 requires:
  //    `/admin/*` and `/login` are not locale-routed, and letting rule 3 reach `/admin` would
  //    redirect it to `/en/admin` before any session check happened.
  //
  //    Nothing below this line can auth-protect anything. The public site, every `[locale]` route,
  //    Products, Blog, Content and the submission forms all fall through to the rules that follow
  //    and are untouched by the session logic — this is a scoped check, not a global guard.
  if (isAdminSurfacePath(pathname)) {
    return resolveAdminRequest(request);
  }

  // 1. The proof tree is not locale-routed and never will be. Checked before anything else that
  //    could rewrite it.
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
