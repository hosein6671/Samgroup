import { sanitizeRichTextHtml } from "./rich-text.sanitizer";
import { normalizeSeo } from "./seo.normalizer";

import type {
  AboutUsClosing,
  AboutUsContent,
  AboutUsExpertise,
  AboutUsHero,
  AboutUsQualityStandards,
  AboutUsWhoWeAre,
  ContentCta,
  ContentFigure,
  ContentImage,
  ContentRouteKey,
} from "@sam-group/types";

/**
 * Payload's `AboutUs` document, reduced to the wire contract.
 *
 * ── The projection is an allow-list, never a filter ─────────────────────────
 *
 * Nothing is copied across because it happened to be present. Every value below is read by name and
 * normalized, so the fields Payload adds on its own — `id`, `_status`, `globalType`, `createdAt`,
 * `updatedAt`, the rich-text AST, the full media record behind an upload — cannot reach a consumer
 * even if a future schema change introduces more of them. `apps/web` has no awareness Payload
 * exists (ADR-003), and that is only true if this file keeps it true.
 *
 * ── Absent is a first-class state ───────────────────────────────────────────
 *
 * Every section but the hero collapses to `null` when it holds no content, so a page published in
 * stages renders the sections that exist and omits the rest. The hero does not: `hero.title` is the
 * page's H1, and a document without one is not a page. The service treats that as unconfigured.
 *
 * ── Types come from `@sam-group/types` rather than being restated ───────────
 *
 * `dto/content-page.response.ts` declares its shape locally and the shared package transcribes it.
 * This one imports instead. The shape is roughly twenty nested types; two hand-maintained copies of
 * it would drift, and the package is already a dependency of this module for `SeoFields`.
 */

/** The five structural destinations the CMS offers, mirroring `about-us.ts`'s option list. */
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

function dimension(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return Math.round(value);
}

/**
 * An expanded upload, reduced to the four facts a consumer can act on.
 *
 * Payload expands an upload into its whole record — filename, prefix, MIME type, filesize, focal
 * point, timestamps, thumbnail URL. All of that describes how the CMS stores the object. The URL is
 * origin-relative by the collection's own `generateFileURL`, so nothing here reveals the object
 * store either.
 */
function image(value: unknown): ContentImage | null {
  if (!isRecord(value)) {
    return null;
  }

  const url = text(value.url);

  if (url === null) {
    return null;
  }

  return {
    url,
    alt: text(value.alt),
    width: dimension(value.width),
    height: dimension(value.height),
  };
}

/** A section's figure. `null` when no image is uploaded — a caption alone is not a figure. */
function figure(section: Record<string, unknown>): ContentFigure | null {
  const source = image(section.image);

  return source === null ? null : { image: source, caption: text(section.imageCaption) };
}

/**
 * A call to action, and `null` unless it is complete.
 *
 * Both halves are required: a label with no destination is a button that goes nowhere, and a
 * destination with no label is a button with no name. An unrecognised route key — a value from a
 * schema newer than this file — is treated as no destination rather than passed through, because
 * `apps/web` resolves the key against a fixed table and has nothing to resolve it to.
 */
function cta(value: unknown): ContentCta | null {
  const source = group(value);
  const label = text(source.label);
  const route = text(source.route);

  if (label === null || route === null || !ROUTE_KEYS.has(route)) {
    return null;
  }

  return { label, route: route as ContentRouteKey };
}

/** True when every value a section could render is absent, which is what makes the section `null`. */
function isEmpty(
  ...values: readonly (string | null | ContentCta | ContentFigure | unknown[])[]
): boolean {
  return values.every((value) =>
    Array.isArray(value) ? value.length === 0 : value === null || value === undefined,
  );
}

function heroOf(doc: Record<string, unknown>): AboutUsHero | null {
  const source = group(doc.hero);
  const title = text(source.title);

  if (title === null) {
    return null;
  }

  return {
    eyebrow: text(source.eyebrow),
    title,
    supportingText: text(source.supportingText),
    primaryCta: cta(source.primaryCta),
    secondaryCta: cta(source.secondaryCta),
    figure: figure(source),
  };
}

function whoWeAreOf(doc: Record<string, unknown>): AboutUsWhoWeAre | null {
  const source = group(doc.whoWeAre);
  const heading = text(source.heading);
  /*
   * Sanitized here rather than trusted from the CMS. The boundary is the API for every consumer at
   * once (API_CONTRACT_FINAL.md §2.4a); a frontend that forgets is then not a vulnerability.
   */
  const bodyHtml = sanitizeRichTextHtml(source.bodyHtml);
  const positions = rows(source.positions)
    .map((row) => ({ term: text(row.term), note: text(row.note) }))
    .filter((row): row is { term: string; note: string } => row.term !== null && row.note !== null);
  const sectionFigure = figure(source);

  if (bodyHtml === "" && isEmpty(heading, positions, sectionFigure)) {
    return null;
  }

  return { heading, bodyHtml, positions, figure: sectionFigure };
}

function expertiseOf(doc: Record<string, unknown>): AboutUsExpertise | null {
  const source = group(doc.expertise);
  const heading = text(source.heading);
  const lead = text(source.lead);
  const items = rows(source.items)
    .map((row) => text(row.name))
    .filter((name): name is string => name !== null)
    .map((name) => ({ name }));

  return isEmpty(heading, lead, items) ? null : { heading, lead, items };
}

function qualityStandardsOf(doc: Record<string, unknown>): AboutUsQualityStandards | null {
  const source = group(doc.qualityStandards);
  const heading = text(source.heading);
  const lead = text(source.lead);
  const items = rows(source.items)
    .map((row) => ({ name: text(row.name), note: text(row.note) }))
    .filter((row): row is { name: string; note: string | null } => row.name !== null);
  const footnote = text(source.footnote);
  const footnoteCta = cta(source.footnoteCta);
  const sectionFigure = figure(source);

  if (isEmpty(heading, lead, items, footnote, footnoteCta, sectionFigure)) {
    return null;
  }

  return { heading, lead, items, footnote, footnoteCta, figure: sectionFigure };
}

function closingOf(doc: Record<string, unknown>): AboutUsClosing | null {
  const source = group(doc.closing);
  const eyebrow = text(source.eyebrow);
  const heading = text(source.heading);
  const lead = text(source.lead);
  const primaryCta = cta(source.primaryCta);
  const routes = rows(source.routes)
    .map((row) => cta(row))
    .filter((route): route is ContentCta => route !== null);

  if (isEmpty(eyebrow, heading, lead, primaryCta, routes)) {
    return null;
  }

  return { eyebrow, heading, lead, primaryCta, routes };
}

/**
 * The whole projection, or `null` when the document is not a page.
 *
 * `null` means **unconfigured**: the Global has never been published, the service identity's
 * published-only constraint excluded it (Payload answers `{}` for both), or an editor has saved a
 * document with no heading. All three are the same fact for a consumer — there is no About page to
 * render — and none of them is an infrastructure failure or a canonical 404.
 */
export function toAboutUsContent(
  doc: Record<string, unknown>,
  locale: string,
): AboutUsContent | null {
  const hero = heroOf(doc);

  if (hero === null) {
    return null;
  }

  return {
    hero,
    whoWeAre: whoWeAreOf(doc),
    expertise: expertiseOf(doc),
    qualityStandards: qualityStandardsOf(doc),
    closing: closingOf(doc),
    /*
     * `alternates` is empty by decision, not by omission. `/about-us` is a structural route whose
     * URL is byte-identical in every locale (PROJECT_HANDOFF.md §6.12), so its `hreflang` set is
     * the platform's `Locale` table rather than a question about CMS translation state. Deriving it
     * from Payload would need a third read to answer something the frontend already knows.
     */
    seo: normalizeSeo(doc.seo, locale, []),
  };
}
