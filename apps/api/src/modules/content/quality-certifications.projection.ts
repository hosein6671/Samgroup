import { normalizeSeo } from "./seo.normalizer";

import type {
  ContentCta,
  ContentFigure,
  ContentImage,
  ContentRouteKey,
  ProductFamilyKey,
  QualityApproach,
  QualityCertificationsContent,
  QualityCertificationsHero,
  QualityCertificationsSection,
  QualityClosing,
  QualityDocumentation,
  QualityLaboratory,
  QualitySampling,
} from "@sam-group/types";

/**
 * Payload's `QualityCertifications` document, reduced to the wire contract.
 *
 * ── The projection is an allow-list, never a filter ─────────────────────────
 *
 * Every value below is read by name and normalized, so the fields Payload adds on its own — `id`,
 * `_status`, `globalType`, `createdAt`/`updatedAt`, version metadata, the whole expanded media
 * record behind an upload — cannot reach a consumer even if a future schema change introduces more
 * of them. `apps/web` has no awareness Payload exists (ADR-003), and that is only true if this file
 * keeps it true.
 *
 * ── What this projection structurally cannot serve ─────────────────────────
 *
 * A certificate, standard, licence, accreditation, issuing body, certificate number, validity date
 * or mark. Not because they are filtered out — because neither the CMS schema nor
 * `QualityCertificationsContent` has anywhere to put one. `certificationsOf` reads five strings and
 * iterates nothing. When the `Certifications` collection and its Admin-only publish gate arrive,
 * this is the function that gains a list; until then there is nothing here to accidentally pass
 * through.
 *
 * ── Two allow-lists, one principle ─────────────────────────────────────────
 *
 * `ROUTE_KEYS` and `FAMILY_KEYS` both exist because a *key* from a schema newer than this file must
 * never be forwarded to a frontend that has nothing to resolve it against. A route key with no
 * destination becomes no action; a family key with no family is dropped from the list. Neither is
 * ever passed through in the hope that somebody downstream copes.
 */

/** The five structural destinations the CMS offers, mirroring `fields/cta.ts`'s option list. */
const ROUTE_KEYS: ReadonlySet<string> = new Set<ContentRouteKey>([
  "products",
  "customized-solutions",
  "quality-certifications",
  "contact-us",
  "request-a-quote",
]);

/**
 * The six frozen Product Family identifiers, mirroring the Global's `sampling.families` options.
 *
 * These are ADR-009 canonical identifiers — `Category.slug` values owned by `sam_platform`. This set
 * is a *validation* copy, not a second source of truth: nothing here is served, and the family's
 * name and address are resolved by `apps/web` against its own canonical table. A value outside this
 * set is dropped, which is the same treatment an unrecognised route key gets.
 */
const FAMILY_KEYS: ReadonlySet<string> = new Set<ProductFamilyKey>([
  "base-oils",
  "lubricant-additives",
  "engine-oils-automotive-lubricants",
  "industrial-oils-lubricants",
  "marine-oils-lubricants",
  "antifreeze-coolants",
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
 * destination with no label is a button with no name. An unrecognised route key is dropped rather
 * than passed through.
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

function heroOf(doc: Record<string, unknown>): QualityCertificationsHero | null {
  const source = group(doc.hero);
  const title = text(source.title);

  if (title === null) {
    return null;
  }

  return {
    eyebrow: text(source.eyebrow),
    title,
    supportingText: text(source.supportingText),
    indexLabel: text(source.indexLabel),
    primaryCta: cta(source.primaryCta),
    secondaryCta: cta(source.secondaryCta),
  };
}

/**
 * An eyebrow is projected but never keeps a section alive.
 *
 * Three sections carry one, and it is read like any other editorial string. What it deliberately
 * does **not** do is count toward whether the section exists: a band whose only content is its own
 * label is a heading over nothing, which is exactly the empty-band render the nullable-section rule
 * exists to prevent. `closingOf` already applies the same reasoning to its eyebrow.
 */
function approachOf(doc: Record<string, unknown>): QualityApproach | null {
  const source = group(doc.approach);
  const heading = text(source.heading);
  const lead = text(source.lead);
  const footnote = text(source.footnote);
  /*
   * A stage needs both halves. A name with no position says less than the name alone already does,
   * and a position with no name cannot be rendered at all.
   */
  const stages = rows(source.stages)
    .map((row) => ({ name: text(row.name), when: text(row.when) }))
    .filter((stage): stage is { name: string; when: string } => {
      return stage.name !== null && stage.when !== null;
    });

  if (heading === null && lead === null && footnote === null && stages.length === 0) {
    return null;
  }

  return { eyebrow: text(source.eyebrow), heading, lead, stages, footnote };
}

/**
 * The laboratory register.
 *
 * A property is projected as a **name and nothing else** — there is no other field to read, in this
 * function or in the CMS. Nothing here derives, infers or annotates a method, a condition, a unit,
 * a result or an in-house marker from a property's name.
 */
function laboratoryOf(doc: Record<string, unknown>): QualityLaboratory | null {
  const source = group(doc.laboratory);
  const heading = text(source.heading);
  const lead = text(source.lead);
  const properties = rows(source.properties)
    .map((row) => text(row.name))
    .filter((name): name is string => name !== null)
    .map((name) => ({ name }));
  const unpublished = rows(source.unpublished)
    .map((row) => ({ name: text(row.name), why: text(row.why) }))
    .filter((entry): entry is { name: string; why: string } => {
      return entry.name !== null && entry.why !== null;
    });
  const sectionFigure = figure(source);

  if (
    heading === null &&
    lead === null &&
    properties.length === 0 &&
    unpublished.length === 0 &&
    sectionFigure === null
  ) {
    return null;
  }

  return {
    eyebrow: text(source.eyebrow),
    heading,
    lead,
    registerLabel: text(source.registerLabel),
    orderNote: text(source.orderNote),
    properties,
    unpublishedHeading: text(source.unpublishedHeading),
    unpublished,
    figure: sectionFigure,
  };
}

/**
 * The withheld certifications statement — five strings, read by name, iterating nothing.
 *
 * There is no array to project and no relation to expand. If a field named `items`, `issuingBody`,
 * `certificateNumber` or `certificateFile` ever appeared in `sam_cms`, it would not be read here:
 * this function names what it serves, so the wire cannot grow a certification claim by accident.
 */
function certificationsOf(doc: Record<string, unknown>): QualityCertificationsSection | null {
  const source = group(doc.certifications);
  const eyebrow = text(source.eyebrow);
  const heading = text(source.heading);
  const status = text(source.status);
  const statement = text(source.statement);
  const note = text(source.note);

  if (
    eyebrow === null &&
    heading === null &&
    status === null &&
    statement === null &&
    note === null
  ) {
    return null;
  }

  return { eyebrow, heading, status, statement, note };
}

function documentationOf(doc: Record<string, unknown>): QualityDocumentation | null {
  const source = group(doc.documentation);
  const heading = text(source.heading);
  const lead = text(source.lead);
  const note = text(source.note);
  const documents = rows(source.documents)
    .map((row) => ({ name: text(row.name), scope: text(row.scope) }))
    .filter((entry): entry is { name: string; scope: string | null } => entry.name !== null);

  if (heading === null && lead === null && note === null && documents.length === 0) {
    return null;
  }

  return {
    eyebrow: text(source.eyebrow),
    heading,
    lead,
    registerLabel: text(source.registerLabel),
    documents,
    note,
  };
}

/**
 * The sampling policy.
 *
 * ── Two things make this section different from every other one ────────────
 *
 * 1. **The statement is required.** It is the section's `<h2>`; a sampling section without it is a
 *    label and a list of families with nothing said about them.
 * 2. **The scope is required too.** `families` is filtered to the frozen allow-list, and a document
 *    whose selection resolves to nothing yields `null` for the whole section. "A sample is issued
 *    before commitment" published with no scope beside it is a broader promise than the
 *    documentation makes — the CMS refuses an empty selection at save time, and this refuses to
 *    serve one that got in another way.
 *
 * Duplicates are collapsed, because two identical keys would render the same family twice.
 */
function samplingOf(doc: Record<string, unknown>): QualitySampling | null {
  const source = group(doc.sampling);
  const statement = text(source.statement);

  if (statement === null) {
    return null;
  }

  const selected: unknown = source.families;
  const families = [
    ...new Set(
      (Array.isArray(selected) ? selected : [])
        .map((value) => text(value))
        .filter((key): key is ProductFamilyKey => key !== null && FAMILY_KEYS.has(key)),
    ),
  ];

  if (families.length === 0) {
    return null;
  }

  return {
    eyebrow: text(source.eyebrow),
    statement,
    familiesLabel: text(source.familiesLabel),
    families,
    limit: text(source.limit),
  };
}

function closingOf(doc: Record<string, unknown>): QualityClosing | null {
  const source = group(doc.closing);
  const heading = text(source.heading);
  const lead = text(source.lead);
  const primaryCta = cta(source.primaryCta);
  const routes = rows(source.routes)
    .map((row) => cta(row))
    .filter((route): route is ContentCta => route !== null);

  if (heading === null && lead === null && primaryCta === null && routes.length === 0) {
    return null;
  }

  return { eyebrow: text(source.eyebrow), heading, lead, primaryCta, routes };
}

/**
 * The whole projection, or `null` when the document is not a page.
 *
 * `null` means **unconfigured**: the Global has never been published, the service identity's
 * published-only constraint excluded it (Payload answers `{}` for both), or an editor saved a
 * document with no heading. None of the three is an infrastructure failure or a canonical 404.
 */
export function toQualityCertificationsContent(
  doc: Record<string, unknown>,
  locale: string,
): QualityCertificationsContent | null {
  const hero = heroOf(doc);

  if (hero === null) {
    return null;
  }

  return {
    hero,
    approach: approachOf(doc),
    laboratory: laboratoryOf(doc),
    certifications: certificationsOf(doc),
    documentation: documentationOf(doc),
    sampling: samplingOf(doc),
    closing: closingOf(doc),
    /*
     * `alternates` is empty by decision: `/quality-certifications` is a structural route whose URL
     * is byte-identical in every locale, so its `hreflang` set is the platform's `Locale` table
     * rather than a question about CMS translation state.
     */
    seo: normalizeSeo(doc.seo, locale, []),
  };
}
