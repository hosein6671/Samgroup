import { redirect } from "next/navigation";

/**
 * Base Oils — a retired proof route. It renders nothing and redirects to the canonical Product
 * Family URL.
 *
 * ── Where this sits in the sequence ─────────────────────────────────────────
 *
 * ADR-010's proof transition runs canonical implementation → canonical validation → **proof
 * redirects** → proof removal. The canonical route at `app/[locale]/products/[slug]/page.tsx` is
 * implemented and validated, so this file's duplicate implementation has no reason to render. It
 * still exists because removal is a separate gate: the URL keeps answering, it just stops being a
 * second copy of the page.
 *
 * ── Why the target carries a locale ─────────────────────────────────────────
 *
 * The target is the **default-locale canonical URL**, not the locale-less `/products/base-oils`
 * the middleware would negotiate into one. These are internal proof URLs, not locale-negotiation
 * entry points, so a single deterministic hop is worth more than a negotiated one — and it avoids
 * a second middleware redirect on top of this one.
 *
 * The literal `en` is the one thing here that states a locale in code rather than reading it from
 * the Locale table. That is deliberate and confined to this tree: the default locale is only known
 * asynchronously (`defaultLocale()` in `lib/locale-contract`), and a proof route about to be
 * deleted is not the place to spend a network call to discover it.
 *
 * ── Why the redirect is the route's own ─────────────────────────────────────
 *
 * `/design-proof/**` is bypassed by the middleware before any other rule (`middleware.ts` rule 1)
 * and stays that way. Nothing but this file is involved in serving the redirect.
 *
 * ── What is gone, on purpose ────────────────────────────────────────────────
 *
 * The `metadata` export: a route that renders no document has nothing to describe. Its `robots:
 * { index: false, follow: false }` is not restated at the target either — `app/[locale]/layout.tsx`
 * declares that for the whole canonical tree and every page inherits it.
 */
export default function BaseOilsProofPage(): never {
  redirect("/en/products/base-oils");
}
