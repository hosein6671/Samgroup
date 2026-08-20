/**
 * The Payload-backed Content resources' wire shapes.
 *
 * Shared rather than declared inside `apps/web`, on the same arrangement `catalog.ts` and `blog.ts`
 * already use: `apps/api` keeps its own DTOs and this is a transcription of them, not
 * `tsc`-enforced agreement with the backend.
 *
 * ── Nothing here is Payload-shaped ──────────────────────────────────────────
 *
 * `apps/web` never calls Payload (ADR-003) and has no awareness it exists. These types describe
 * what NestJS serves; the CMS's own document shape — its ids, its rich-text AST, its `docs[]`
 * wrapper, its draft status — stops at the Content module and is never transcribed here.
 */

import type { SeoFields } from "./seo";

/**
 * One page from `GET /content/pages/:slug` — the Payload `Pages` collection, which holds legal
 * pages and nothing else (PAYLOAD_CONTENT_ARCHITECTURE.md §1).
 *
 * `title` and `bodyHtml` carry the requested locale's values; an untranslated page is served in the
 * default locale and the response's `meta.localeFallback` says so (API_CONTRACT_FINAL.md §3).
 *
 * `seo` carries the shared `SeoFields` contract — the same shape Prisma-owned content will serve
 * from its own `SeoMeta` table, normalized by NestJS so `apps/web` cannot tell the two apart
 * (SEO_ARCHITECTURE.md §0).
 */
export type ContentPageResponse = {
  /** The URL segment, identical in every locale (PROJECT_HANDOFF.md §6.12). */
  slug: string;
  title: string;
  /**
   * The page body as HTML, **sanitized server-side by NestJS before it is served**.
   *
   * Allow-list markup — headings, emphasis, lists, links, quotes, tables — with no script host, no
   * event-handler attribute, no `style`, no embed, and no URL scheme outside
   * `http`/`https`/`mailto`/`tel`. Safe to render as markup; that is the point of the boundary
   * being in the API rather than in each consumer.
   */
  bodyHtml: string;
  /** ISO 8601, or null when the editor has not set one. Not localized. */
  lastUpdatedDate: string | null;
  /**
   * The page's SEO record for the requested locale, after the API's fallbacks.
   *
   * Always present — a page with no SEO values yields nulls and documented defaults rather than a
   * missing object, so `generateMetadata` reads one shape.
   *
   * `socialImage` and `twitterImage` carry a URL, alt text and intrinsic dimensions. Their URLs are
   * **origin-relative** (`/media/cms/<file>`), served from this site's own origin by nginx. Open
   * Graph requires absolute URLs, so absolutising them is the frontend's job — Next's Metadata API
   * does it against `metadataBase`.
   */
  seo: SeoFields;
};

/* --------------------------------------------------------- company Globals */

/**
 * A structural destination an editorial call to action may point at.
 *
 * **Keys, not URLs, and that is the contract.** Structural page URLs stay fixed English across
 * locales and are locale-prefixed when they are rendered (PROJECT_HANDOFF.md §6.12), so the path a
 * key resolves to belongs to `apps/web` — the same division that leaves absolutising a social image
 * URL to the frontend. An editor picks a destination from the site's own list; nobody types a path
 * into a CMS text field.
 */
export type ContentRouteKey =
  "products" | "customized-solutions" | "quality-certifications" | "contact-us" | "request-a-quote";

/** An editorial call to action: the wording, and where it goes. */
export type ContentCta = {
  label: string;
  route: ContentRouteKey;
};

/**
 * An image on an editorial page, after the API has normalized it.
 *
 * The same four fields `SeoImage` carries, and deliberately a separate type: a photograph in a page
 * section and the image a link preview uses are different content decisions that happen to need the
 * same four values. `url` is **origin-relative** (`/media/cms/<file>`), served from this site's own
 * origin by nginx.
 */
export type ContentImage = {
  url: string;
  alt: string | null;
  width: number | null;
  height: number | null;
};

/** A section's optional photograph, with the caption printed beneath it. */
export type ContentFigure = {
  image: ContentImage;
  caption: string | null;
};

export type AboutUsHero = {
  eyebrow: string | null;
  /** The page's H1. Always present — a document without one is not served at all. */
  title: string;
  supportingText: string | null;
  primaryCta: ContentCta | null;
  secondaryCta: ContentCta | null;
  figure: ContentFigure | null;
};

export type AboutUsWhoWeAre = {
  heading: string | null;
  /**
   * The section's prose as HTML, **sanitized server-side by NestJS before it is served** — the same
   * allow-list rebuild `ContentPageResponse.bodyHtml` carries, for the same reason.
   */
  bodyHtml: string;
  positions: { term: string; note: string }[];
  figure: ContentFigure | null;
};

export type AboutUsExpertise = {
  heading: string | null;
  lead: string | null;
  items: { name: string }[];
};

export type AboutUsQualityStandards = {
  heading: string | null;
  lead: string | null;
  items: { name: string; note: string | null }[];
  footnote: string | null;
  footnoteCta: ContentCta | null;
  figure: ContentFigure | null;
};

export type AboutUsClosing = {
  eyebrow: string | null;
  heading: string | null;
  lead: string | null;
  primaryCta: ContentCta | null;
  routes: ContentCta[];
};

/**
 * The About Us page's editorial content, from `GET /content/globals/about-us`.
 *
 * ── Every section but the hero is nullable, and that is the cutover contract ─
 *
 * A section with no content is `null` and the page renders without it. That is the approved
 * "missing optional section may render absent" behaviour, and it is what lets an editor publish the
 * page in stages instead of all at once.
 *
 * The hero is not optional: `hero.title` is the page's H1, and a Global that has none is reported as
 * **unavailable** rather than served headless — a 200 carrying `available: false`, never a 404. See
 * `ContentGlobalResponse` for why that distinction is load-bearing.
 *
 * ── Nothing here is Payload-shaped ──────────────────────────────────────────
 *
 * No document id, no `_status`, no `createdAt`/`updatedAt`, no version metadata, no rich-text AST.
 * `apps/web` cannot tell this came from a CMS, which is the point of the boundary.
 */
export type AboutUsContent = {
  hero: AboutUsHero;
  whoWeAre: AboutUsWhoWeAre | null;
  expertise: AboutUsExpertise | null;
  qualityStandards: AboutUsQualityStandards | null;
  closing: AboutUsClosing | null;
  /**
   * The page's SEO record for the requested locale.
   *
   * `alternates` is always empty: `/about-us` is a structural route whose URL is identical in every
   * locale, so its `hreflang` set is the platform's `Locale` table rather than a CMS translation
   * state (PROJECT_HANDOFF.md §6.12).
   */
  seo: SeoFields;
};

/**
 * What `GET /content/globals/:name` serves for a Global the API recognises.
 *
 * ── Why "unpublished" is a 200 and not a 404 ────────────────────────────────
 *
 * A recognised Global with nothing published is **not** an unknown resource. `about-us` exists in
 * the contract, the route exists in the site, and the only thing missing is an editor's publish —
 * a fact about a schedule, not about the URL. Collapsing that into `NOT_FOUND` would make it
 * indistinguishable from a name the API has never heard of, and would hand `apps/web` a 404 it must
 * then be trusted never to act on.
 *
 * So the distinction is carried in the response body, where it is explicit and typed:
 *
 * - **unknown name** → 404 `NOT_FOUND`, decided before any CMS call;
 * - **known name, nothing published** → 200 with `available: false`;
 * - **CMS unreachable or answering badly** → 503 `UPSTREAM_UNAVAILABLE`.
 *
 * Payload's own empty document (`{}`) never reaches a consumer: `available: false` is this
 * application's statement about the resource, not the CMS's raw answer passed through.
 */
export type ContentGlobalResponse<T> =
  { available: true; content: T } | { available: false; content: null };

/** `GET /content/globals/about-us`. */
export type AboutUsResponse = ContentGlobalResponse<AboutUsContent>;

/* -------------------------------------------------- Customized Solutions */

/**
 * An action whose destination is a structural anchor on the page it sits on.
 *
 * **It carries a label and nothing else, and that is the contract.** The anchor id is declared by
 * the component that owns the section, shared in links, and changed only by changing the markup.
 * Storing it in the CMS would let an edit silently break a fragment somebody had already sent, and
 * would mix page anchors into `ContentRouteKey`, whose vocabulary describes *pages*. An editor
 * renames the button; nobody can point it somewhere else.
 */
export type ContentAnchorCta = {
  label: string;
};

export type CustomizedSolutionsHero = {
  eyebrow: string | null;
  /** The page's H1. Always present — a document without one is not served at all. */
  title: string;
  supportingText: string | null;
  /** Jumps to the request form on this same page. The frontend owns the target. */
  requestCta: ContentAnchorCta | null;
  routeCta: ContentCta | null;
};

export type CustomizedSolutionsIntroduction = {
  heading: string | null;
  /**
   * The section's prose as HTML, **sanitized server-side by NestJS before it is served** — the same
   * allow-list rebuild every other Content response carries, for the same reason.
   */
  bodyHtml: string;
};

export type CustomizedSolutionsProcess = {
  heading: string | null;
  lead: string | null;
  /**
   * The stages in order. A step's number is its position in this array — it is not stored, because
   * storing a number beside a position is storing the same fact twice — and there is no
   * description: none is written for any step.
   */
  steps: { name: string }[];
};

/**
 * The Customized Solutions page's editorial content, from
 * `GET /content/globals/customized-solutions`.
 *
 * ── What this deliberately does not carry: the form ────────────────────────
 *
 * The Custom Product Request form on this page is **Prisma's and the API's** — its fields, their
 * labels, the Incoterm options, the validation and the consent text all follow the
 * `custom_formulation_requests` columns and the DTO that writes them. None of it appears here, and
 * the page renders the form from code regardless of what the CMS holds.
 *
 * ── Sections below the hero are nullable ───────────────────────────────────
 *
 * A section with no content is `null` and is not rendered, so the page can be published in stages.
 * The hero is not optional: `hero.title` is the page's H1, and a Global that has none is reported
 * as unavailable rather than served headless.
 */
export type CustomizedSolutionsContent = {
  hero: CustomizedSolutionsHero;
  introduction: CustomizedSolutionsIntroduction | null;
  process: CustomizedSolutionsProcess | null;
  /**
   * `alternates` is always empty: `/customized-solutions` is a structural route whose URL is
   * identical in every locale, so its `hreflang` set is the platform's `Locale` table rather than a
   * CMS translation state (PROJECT_HANDOFF.md §6.12).
   */
  seo: SeoFields;
};

/** `GET /content/globals/customized-solutions`. */
export type CustomizedSolutionsResponse = ContentGlobalResponse<CustomizedSolutionsContent>;
