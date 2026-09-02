import { notFound, redirect } from "next/navigation";

/**
 * The production gate for the transitional proof routes.
 *
 * ── What this implements, and what approved it ──────────────────────────────
 *
 * Owner decision, 2 September 2026: **in production, proof pages with canonical equivalents
 * redirect to their canonical default-locale routes; proof routes remain available in
 * development; `cms-proof` returns 404 in production until its legal canonical target is
 * published.**
 *
 * That supersedes the earlier follow-up recorded in
 * `docs/legal/OWNER-QUESTIONNAIRE-privacy-policy.md`, which asked for a blanket production 404
 * across the whole proof tree. A blanket 404 was the right instinct — the concern it was written
 * for is that a production visitor must never reach a proof page's form — but a redirect satisfies
 * that concern and is strictly better for the routes that have somewhere real to go: the reader
 * lands on the page they were looking for instead of on an error, and ADR-010 §9 already names
 * "proof routes redirect to their canonical default-locale routes" as the step before the proof
 * implementation is removed. `cms-proof` keeps the 404, because it is the one proof route whose
 * canonical target does not exist.
 *
 * ── Why the gate runs before anything else in a page ────────────────────────
 *
 * Every gated page below calls its gate as the **first statement**, ahead of any `await`. Two
 * things follow, and both are the point:
 *
 *   1. **No form on a proof route is reachable by a production visitor.** These pages render the
 *      real shared experiences, forms included; returning before the render means no form markup
 *      is produced, no third-party script loads from one, and no enquiry can be created through
 *      one. That is the requirement the questionnaire's follow-up actually cared about.
 *   2. **No API call is made for a request that is going to be redirected.** The proof pages read
 *      the locale table and the Content API; gating first means a redirected request costs
 *      nothing upstream.
 *
 * ── Why this is not a middleware rule and not a robots directive ────────────
 *
 * Not middleware: `middleware.ts` bypasses `/design-proof/**` before any other rule, deliberately,
 * and the six Product Family proof routes already redirect from inside their own page files. This
 * follows that established convention rather than opening a second mechanism for the same job.
 *
 * Not `robots.txt` or `robots` metadata: those govern *crawling*, not *access*. A disallowed page
 * is still served to anyone with the URL, which is exactly the gap the questionnaire called out.
 * The existing `noindex` metadata stays — it is complementary, not a substitute.
 */

/**
 * Each gated design-proof route and the canonical URL it stands in for.
 *
 * The targets carry the default locale explicitly rather than relying on the middleware to
 * negotiate one onto a locale-less path. These are internal proof URLs, not locale-negotiation
 * entry points, so one deterministic hop beats a negotiated one — and it avoids stacking a second
 * middleware redirect on top of this one. It is the same reasoning, and the same literal `en`, that
 * the six Product Family proof routes already use.
 *
 * The six Product Family routes are deliberately **absent**. They redirect unconditionally from
 * their own files and are left exactly as they are.
 */
export const PROOF_CANONICAL_TARGETS = {
  "/design-proof": "/en",
  "/design-proof/about-us": "/en/about-us",
  "/design-proof/products": "/en/products",
  "/design-proof/customized-solutions": "/en/customized-solutions",
  "/design-proof/quality-certifications": "/en/quality-certifications",
} as const;

/** A design-proof route that this gate governs. */
export type GatedProofRoute = keyof typeof PROOF_CANONICAL_TARGETS;

/**
 * Whether the app is running as a production build.
 *
 * `NODE_ENV` and not a bespoke flag: Next sets it to `development` under `next dev` and to
 * `production` under `next build` / `next start`, which is exactly the distinction the owner
 * decision draws. It takes the value as a parameter so the matrix can be tested both ways without
 * a build.
 */
export function isProductionRuntime(nodeEnv: string | undefined = process.env.NODE_ENV): boolean {
  return nodeEnv === "production";
}

/**
 * Redirect a design-proof route to its canonical default-locale URL, in production only.
 *
 * Returns normally in development, which is what keeps the proof tree usable there. In production
 * `redirect()` throws, so nothing after the call in a page body runs — that is how the "no proof
 * form reaches a production visitor" guarantee is enforced rather than merely intended.
 *
 * `redirect()` answers **307**, matching the six Product Family proof routes. Temporary is correct:
 * these URLs are scheduled for deletion, not for permanent reassignment, so nothing should cache
 * the mapping past the gate that removes the routes.
 */
export function gateProofRouteForProduction(route: GatedProofRoute): void {
  if (!isProductionRuntime()) return;

  redirect(PROOF_CANONICAL_TARGETS[route]);
}

/**
 * Answer 404 for the CMS proof route, in production only.
 *
 * A redirect is not available here and must not be invented. `cms-proof` demonstrates the Payload →
 * NestJS → Next.js path for the `Pages` collection, whose canonical counterparts are the legal
 * pages — and every one of them is blocked on approved, legally reviewed text that does not exist.
 * `/{locale}/privacy-policy` answers 404 today for that reason. Pointing this route at it would
 * redirect one 404 to another; pointing it at any other page would publish CMS content as though it
 * were policy.
 *
 * So the route is simply not part of the production surface until that content is published, at
 * which point this becomes a redirect like the others and then a deletion, per ADR-010 §9.
 */
export function gateCmsProofRouteForProduction(): void {
  if (!isProductionRuntime()) return;

  notFound();
}
