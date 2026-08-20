import { sanitizeRichTextHtml } from "./rich-text.sanitizer";
import { normalizeSeo } from "./seo.normalizer";

import type {
  ContentAnchorCta,
  ContentCta,
  ContentRouteKey,
  CustomizedSolutionsContent,
  CustomizedSolutionsHero,
  CustomizedSolutionsIntroduction,
  CustomizedSolutionsProcess,
} from "@sam-group/types";

/**
 * Payload's `CustomizedSolutions` document, reduced to the wire contract.
 *
 * ── The projection is an allow-list, never a filter ─────────────────────────
 *
 * Every value below is read by name and normalized, so the fields Payload adds on its own — `id`,
 * `_status`, `globalType`, `createdAt`/`updatedAt`, the rich-text AST — cannot reach a consumer even
 * if a future schema change introduces more of them.
 *
 * ── The request action is a label, and this file is where that is enforced ──
 *
 * `requestCta` projects **only** a label. The page's request anchor is structural, owned by the
 * component that declares it, and nothing in the CMS document can move it — not a `route`, not an
 * `href`, not a target. Even if a field of that name appeared in `sam_cms` tomorrow, it would not
 * be read here.
 */

/** The five structural destinations the CMS offers, mirroring `fields/cta.ts`'s option list. */
const ROUTE_KEYS: ReadonlySet<string> = new Set<ContentRouteKey>([
  "products",
  "customized-solutions",
  "quality-certifications",
  "contact-us",
  "request-a-quote",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A trimmed string, or `null` for anything that is not one — including whitespace. */
function text(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed === "" ? null : trimmed;
}

function group(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function rows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

/**
 * A route action, and `null` unless it is complete.
 *
 * Both halves are required: a label with no destination is a button that goes nowhere, and a
 * destination with no label is a button with no name. An unrecognised route key — a value from a
 * schema newer than this file — is dropped rather than passed through, because `apps/web` resolves
 * the key against a fixed table and has nothing to resolve it to.
 */
function routeCta(value: unknown): ContentCta | null {
  const source = group(value);
  const label = text(source.label);
  const route = text(source.route);

  if (label === null || route === null || !ROUTE_KEYS.has(route)) {
    return null;
  }

  return { label, route: route as ContentRouteKey };
}

/** An anchor action: the label alone. Its destination is the page's, not the document's. */
function anchorCta(value: unknown): ContentAnchorCta | null {
  const label = text(group(value).label);

  return label === null ? null : { label };
}

function heroOf(doc: Record<string, unknown>): CustomizedSolutionsHero | null {
  const source = group(doc.hero);
  const title = text(source.title);

  if (title === null) {
    return null;
  }

  return {
    eyebrow: text(source.eyebrow),
    title,
    supportingText: text(source.supportingText),
    requestCta: anchorCta(source.requestCta),
    routeCta: routeCta(source.routeCta),
  };
}

function introductionOf(doc: Record<string, unknown>): CustomizedSolutionsIntroduction | null {
  const source = group(doc.introduction);
  const heading = text(source.heading);
  /*
   * Sanitized here rather than trusted from the CMS. The boundary is the API for every consumer at
   * once (API_CONTRACT_FINAL.md §2.4a); a frontend that forgets is then not a vulnerability.
   */
  const bodyHtml = sanitizeRichTextHtml(source.bodyHtml);

  return heading === null && bodyHtml === "" ? null : { heading, bodyHtml };
}

function processOf(doc: Record<string, unknown>): CustomizedSolutionsProcess | null {
  const source = group(doc.process);
  const heading = text(source.heading);
  const lead = text(source.lead);
  const steps = rows(source.steps)
    .map((row) => text(row.name))
    .filter((name): name is string => name !== null)
    .map((name) => ({ name }));

  if (heading === null && lead === null && steps.length === 0) {
    return null;
  }

  return { heading, lead, steps };
}

/**
 * The whole projection, or `null` when the document is not a page.
 *
 * `null` means **unconfigured**: the Global has never been published, the service identity's
 * published-only constraint excluded it (Payload answers `{}` for both), or an editor saved a
 * document with no heading. None of the three is an infrastructure failure or a canonical 404.
 */
export function toCustomizedSolutionsContent(
  doc: Record<string, unknown>,
  locale: string,
): CustomizedSolutionsContent | null {
  const hero = heroOf(doc);

  if (hero === null) {
    return null;
  }

  return {
    hero,
    introduction: introductionOf(doc),
    process: processOf(doc),
    /*
     * `alternates` is empty by decision: `/customized-solutions` is a structural route whose URL is
     * byte-identical in every locale, so its `hreflang` set is the platform's `Locale` table rather
     * than a question about CMS translation state.
     */
    seo: normalizeSeo(doc.seo, locale, []),
  };
}
