import { cache } from "react";

import { ROUTES, localeHref } from "@/features/site/site-routes";
import { getContentPage } from "@/lib/content";

import type { ContentPageResult } from "@/lib/content";

/**
 * Whether the canonical Privacy Policy may be linked to — resolved once per request.
 *
 * ── Why a link to this route has to be earned ───────────────────────────────
 *
 * `/{locale}/privacy-policy` is a canonical route whose entire content is a published Payload
 * `Pages` document (see `app/[locale]/privacy-policy/page.tsx`). Until an editor publishes one
 * after legal review it answers **404 in every locale**, and that is the ratified behaviour rather
 * than a gap to paper over.
 *
 * ROADMAP.md records the ordering in as many words: consent links may go live only after BOTH
 * approved published Privacy Policy content exists AND policy-version persistence is implemented in
 * `sam_platform`. The second condition closed on 18 August 2026. The first is content, and no code
 * change can close it — so the link is gated on the fact rather than on a flag someone has to
 * remember to flip: **the footer and the consent labels link the policy exactly when the CMS is
 * serving one, and name it as plain text otherwise.**
 *
 * A link to a 404 beside a consent checkbox is worse than no link, and a link to a 404 in the
 * footer of every page on the platform is worse still. This module is what makes both impossible
 * without anyone having to keep two facts in step by hand.
 *
 * ── The five states, and what each one produces ─────────────────────────────
 *
 * | CMS / API condition                          | `getPrivacyPolicyHref` | Rendered as        |
 * | -------------------------------------------- | ---------------------- | ------------------ |
 * | A published `privacy-policy` page exists      | the locale's href      | a link             |
 * | No such page (definitive 404)                 | `null`                 | plain text         |
 * | Only a draft exists — drafts are not public   | `null`                 | plain text         |
 * | API unreachable                               | `null`                 | plain text         |
 * | API or CMS answered, but not with a page      | `null`                 | plain text         |
 *
 * The last two rows are deliberately **not** the unavailable state the Privacy Policy route itself
 * renders. That route's whole subject is the document, so reporting "unknown" as "absent" there
 * would tell a crawler the company had withdrawn its policy (ADR-010 §7). A footer link is not the
 * document: degrading it to the wording it already carries costs a reader nothing, whereas emitting
 * a link during a CMS outage would send them to a page that cannot render.
 *
 * ── One request, not one per consumer ───────────────────────────────────────
 *
 * `resolvePrivacyPolicy` is React's per-request memo wrapped around the same `getContentPage` the
 * route calls, and it is exported so the route calls **this** instance. Every consumer — the
 * footer, the Contact Us inquiry form, the Customized Solutions request form, and the Privacy
 * Policy page itself — therefore shares one lookup per request, and none of them can disagree with
 * another about whether the policy exists.
 */

/**
 * The slug of the Payload `Pages` document the canonical route renders.
 *
 * A constant, not a URL segment. It matches the route path because structural URLs stay fixed
 * English (PROJECT_HANDOFF.md §6.12) and `Pages.slug` is deliberately not localized for the same
 * reason — so one value is correct for all three locales.
 */
export const PRIVACY_POLICY_SLUG = "privacy-policy";

/**
 * One Privacy Policy lookup per request, shared by every consumer.
 *
 * `cache` is React's per-request memo. Outside a render — in a spec, say — it falls back to calling
 * through, which is exactly the behaviour a test wants.
 *
 * Wrapped in an arrow rather than passed as `cache(getContentPage)`, so `getContentPage` is read
 * when the lookup runs instead of when this module is imported. That matters because the footer
 * imports this file, the footer is on every page, and a spec that partially mocks `@/lib/content`
 * would otherwise fail at import time on a function it never calls.
 */
export const resolvePrivacyPolicy = cache(
  async (slug: string, locale: string): Promise<ContentPageResult> => getContentPage(slug, locale),
);

/**
 * The href a consumer should use, given an already-resolved lookup — pure, and separately testable.
 *
 * Only `ok` produces an address. Every other outcome is `null`; see the table above for why the
 * infrastructure outcomes join the definitive ones here rather than being surfaced.
 */
export function privacyPolicyHrefFrom(locale: string, result: ContentPageResult): string | null {
  return result.ok ? localeHref(locale, ROUTES.privacyPolicy) : null;
}

/**
 * The Privacy Policy's address in this locale, or `null` when there is no published policy to link.
 *
 * Never throws: `getContentPage` reports every API condition as a value, and each of them maps to
 * `null` here. A consumer therefore never has to handle a failure — it renders a link or it does
 * not.
 */
export const getPrivacyPolicyHref = cache(async (locale: string): Promise<string | null> => {
  const result = await resolvePrivacyPolicy(PRIVACY_POLICY_SLUG, locale);

  return privacyPolicyHrefFrom(locale, result);
});
