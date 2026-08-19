/**
 * The Admin surface's paths. Three, and none of them is locale-prefixed.
 *
 * ── Deliberately not in `site-routes.ts` ────────────────────────────────────
 *
 * That file is the public site's route vocabulary, and `middleware.ts` derives its
 * `STRUCTURAL_SEGMENTS` set from it — every value there becomes a locale-redirect candidate. An
 * Admin path added to it would be rewritten `/admin` → `/en/admin` before the session check ever
 * ran, which FRONTEND_ARCHITECTURE §2 names as the specific reason admin has to short-circuit
 * first. Keeping the two vocabularies apart is what makes that structural rather than remembered.
 *
 * ── Outside `[locale]`, and frozen there ────────────────────────────────────
 *
 * FRONTEND_ARCHITECTURE §1 puts the Admin Dashboard in an `(admin)` route group outside the
 * `[locale]` segment, so its URLs are `/admin/...` and never `/en/admin/...`. Three URLs for one
 * internal tool would pull it into `generateStaticParams`, into the sitemap, and into `hreflang` —
 * onto a surface that must never be indexed at all. Admin UI language is a user preference, not a
 * route segment.
 *
 * `/login` sits beside `/admin` rather than under it, because that is what the frozen route tree
 * says: `app/(admin)/login/page.tsx` is a sibling of `app/(admin)/admin/`, and §2 names the pair
 * as "`/admin/*` and `/login`". It is not `/admin/login`.
 */

/** The login page. Reachable without a session — it is the only Admin path that is. */
export const LOGIN_PATH = "/login";

/** The Admin shell. Requires a session and the `admin` role. */
export const ADMIN_PATH = "/admin";

/**
 * The credential-clearing Route Handler.
 *
 * It exists because of a Next constraint rather than a design preference. A Server Component cannot
 * mutate cookies (`cookies().set()` throws outside the action phase), so when `GET /auth/me`
 * refuses an access token that the browser still holds — a disabled account, a deleted account, a
 * credential-revocation cutoff — the render has no way to clear it. Redirecting straight to
 * `/login` would leave the stale cookie in place, middleware would see it on the next request and
 * wave it through, and the two would bounce until the cookie aged out.
 *
 * So the render redirects here instead: a Route Handler *can* set cookies, it clears both and
 * redirects to `/login`, and the loop is closed in one hop. It takes **no parameters** — no
 * `next`, no `returnTo`, no forwarding of any kind — so it is not a redirect surface and cannot be
 * pointed anywhere but at the login page.
 */
export const SESSION_END_PATH = "/admin/session/end";

/** Whether a path belongs to the Admin surface, and therefore skips locale routing entirely. */
export function isAdminSurfacePath(pathname: string): boolean {
  return (
    pathname === LOGIN_PATH || pathname === ADMIN_PATH || pathname.startsWith(`${ADMIN_PATH}/`)
  );
}
