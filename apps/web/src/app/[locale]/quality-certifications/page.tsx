import type { Metadata } from "next";
import type { ReactNode } from "react";

import { QualityExperience } from "@/features/quality/quality-experience";

/**
 * The Quality & Certifications page, on its canonical route — `/{locale}/quality-certifications`.
 *
 * `QualityExperience` is rendered **unchanged**, exactly as the three pages promoted before it
 * were: the component takes no props, reads no locale, performs no fetch, and supplies the
 * `#main-content` target the root layout's skip link points at. Its own header note called this
 * lift "this file unchanged plus swapping `quality-data.ts` from fixtures to the Payload
 * `QualityCertifications` Global through NestJS" — **only the first half is this gate.**
 *
 * ── What this promotion resolves ────────────────────────────────────────────
 *
 * The footer's Company column and About Us's quality footnote both point at
 * `ROUTES.qualityCertifications`, and both 404'd. This is the address the platform gives for the
 * certification question, so it resolving matters more here than the link count suggests.
 *
 * ── The page's proof-state furniture lifts with it, deliberately ─────────────
 *
 * Nothing on this page is softened by the promotion. The Certifications band still publishes one
 * statement and no list — no certificate, standard, licence, accreditation, issuing body, number,
 * validity date, mark or greyed-out slot, because SITE_STRUCTURE §7 is emphatic that no
 * placeholder certification is ever published and the shape of one is still one. The laboratory
 * register still carries fourteen property names with no method, no condition and no value, and
 * still names the four things it withholds — including whether any test is run in-house. The
 * sampling policy still publishes its limit alongside itself. None of that is touched here, and a
 * route promotion is precisely the wrong moment to soften a page whose source document calls it
 * the platform's highest-stakes page for accuracy.
 *
 * ── Media, recorded and not implemented ─────────────────────────────────────
 *
 * One frame, unchanged: `MEDIA.laboratory` in `QualityLaboratory` — "Laboratory · testing bench",
 * captioned "instruments and bench, not portraits". It is the strongest single-image opportunity
 * on the three pages in this batch and the one slot here with a matching Payload field
 * ("lab/testing photography"), so it is a one-element swap when the shoot happens. The Global's
 * `heroImage` still has no slot on this page and that stays deliberate — `quality-data.ts` records
 * why the hero's right column is the verification chain rather than a second empty frame.
 *
 * **No certification imagery, in any form, ever arrives through this route.** When the list is
 * confirmed it arrives as real uploads on the Payload `Certifications` collection.
 *
 * ── No `generateStaticParams`, and no `dynamicParams` ───────────────────────
 *
 * The `[locale]` segment is the parent's, and `app/[locale]/layout.tsx` already generates it from
 * the `Locale` table and closes it with `dynamicParams = false`. This route introduces no dynamic
 * segment of its own, so it has nothing to enumerate — restating either here would be a second
 * copy of the locale source that PROJECT_HANDOFF §6.9 keeps singular.
 *
 * ── Metadata, and what is deliberately absent ───────────────────────────────
 *
 * The title and description are the proof route's own two strings, character for character.
 *
 * **No `robots`.** `app/[locale]/layout.tsx` declares `robots: { index: false, follow: false }` for
 * this whole tree and every page inherits it. **No canonical and no `hreflang`** — both are
 * ADR-010 Non-Goals, and P3b is a route promotion, not the SEO launch. **No JSON-LD** —
 * `AboutPage` structured data waits on the shared `<JsonLd>` component specified in
 * FRONTEND_ARCHITECTURE §4, which does not exist.
 *
 * ── The proof route is still live ───────────────────────────────────────────
 *
 * `/design-proof/quality-certifications` renders this same experience until a later gate redirects
 * it, per ADR-010 §9's order. Both trees carry `noindex, nofollow` from their own layouts, and the
 * proof route is what this one is validated against.
 */
export const metadata: Metadata = {
  title: "Quality & Certifications — Sam Group",
  description:
    "Testing at three stages, the properties the laboratory tests for, and the documentation issued with every batch.",
};

export default function QualityCertificationsPage(): ReactNode {
  return <QualityExperience />;
}
