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

export type AboutUsTeam = {
  eyebrow: string | null;
  heading: string | null;
  lead: string | null;
  functions: { name: string; note: string }[];
  figure: ContentFigure | null;
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
  team: AboutUsTeam | null;
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

export type CustomizedSolutionsCapability = {
  title: string;
  description: string | null;
};

export type CustomizedSolutionsProcess = {
  heading: string | null;
  lead: string | null;
  /**
   * The stages in order. A step's number is its position in this array — it is not stored, because
   * storing a number beside a position is storing the same fact twice — and there is no
   * description explains the information transition at that stage without promising timing or an
   * outcome.
   */
  steps: { name: string; description: string | null }[];
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
  capabilities: CustomizedSolutionsCapability[];
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

/* ------------------------------------------------ Quality & Certifications */

/**
 * A Product Family, as an identifier.
 *
 * **The canonical ADR-009 identifier**: one string that is simultaneously the default-locale
 * `Category.slug` in `sam_platform`, the `/{locale}/products/{slug}` route segment, Payload's
 * `categoryKey`, and the frontend's `ProductFamily` key.
 *
 * It appears on this wire for one reason — the sampling policy is confirmed for some families and
 * not others, and the CMS holds *which*. It never carries a family's name or its address: those are
 * Prisma-owned and code-navigated, and Payload may never mirror a Prisma entity (ADR-002).
 * `apps/web` resolves a key against its own canonical table, exactly as it resolves a
 * `ContentRouteKey`, and a key it cannot resolve is dropped rather than rendered.
 */
export type ProductFamilyKey =
  | "base-oils"
  | "lubricant-additives"
  | "engine-oils-automotive-lubricants"
  | "industrial-oils-lubricants"
  | "marine-oils-lubricants"
  | "antifreeze-coolants";

export type QualityCertificationsHero = {
  eyebrow: string | null;
  /** The page's H1. Always present — a document without one is not served at all. */
  title: string;
  supportingText: string | null;
  /** The heading over the hero's stage chain. The chain's contents come from `approach.stages`. */
  indexLabel: string | null;
  primaryCta: ContentCta | null;
  secondaryCta: ContentCta | null;
};

/**
 * One testing stage.
 *
 * `when` says **where in the material's passage the stage sits** — the meaning the stage's own name
 * already carries. There is deliberately no field for what happens inside it: no approved document
 * describes any stage's contents, and elaborating one would be writing a procedure.
 */
export type QualityStage = {
  name: string;
  when: string;
};

export type QualityApproach = {
  /**
   * The band's own label.
   *
   * Editorial content, not chrome: it is a visible line of page copy, so it is localized in the CMS
   * and `null` when unwritten. **The frontend supplies no English fallback for it** — on a page
   * served in three languages, a code-owned label is one a Persian or Arabic reader meets in
   * English above translated content.
   */
  eyebrow: string | null;
  heading: string | null;
  lead: string | null;
  stages: QualityStage[];
  /** What this section does not publish, stated in the section. */
  footnote: string | null;
};

/**
 * One property the laboratory tests for — **a name, and nothing else**.
 *
 * No `method`, `condition`, `unit`, `value` or `accreditation` field exists on this type, and none
 * exists in the CMS either. No approved document in this project names a single test standard, and a
 * designation cited wrongly against a real property is a technical error a buyer would specify
 * against. A property name does not establish that the test is performed, performed in-house, or
 * performed against any standard.
 */
export type QualityProperty = {
  name: string;
};

/** One attribute the register deliberately does not carry, and the reason, both published. */
export type QualityUnpublishedAttribute = {
  name: string;
  why: string;
};

export type QualityLaboratory = {
  /** The band's own label — localized CMS copy, never a code string. See `QualityApproach`. */
  eyebrow: string | null;
  heading: string | null;
  lead: string | null;
  registerLabel: string | null;
  orderNote: string | null;
  properties: QualityProperty[];
  unpublishedHeading: string | null;
  unpublished: QualityUnpublishedAttribute[];
  /** `null` when no photograph is uploaded. The section then renders no figure at all. */
  figure: ContentFigure | null;
};

/**
 * The certifications section — **five strings, and structurally nothing else**.
 *
 * ── Why there is no array here ──────────────────────────────────────────────
 *
 * Because there is nothing to put in one. SITE_STRUCTURE §7 blocks this section until a real
 * certificate list exists and is emphatic that no placeholder certification is ever published; the
 * *shape* of a certification claim is still one, and a reader counts empty slots.
 *
 * So this type carries no `items`, no `issuingBody`, no `certificateNumber`, no `validUntil`, no
 * file and no link — absent rather than empty, so a plausible guess cannot be dropped into a slot.
 * The `Certifications` collection and its Admin-only publish gate are a later gate; when they
 * arrive, an optional array joins this object and every existing consumer keeps working.
 *
 * `status` is words, never a colour: the page renders it as text beside a decorative mark.
 */
export type QualityCertificationsSection = {
  eyebrow: string | null;
  heading: string | null;
  status: string | null;
  statement: string | null;
  note: string | null;
};

/**
 * One document issued with supply.
 *
 * **There is no `href` and no file.** Whether any of these can be obtained from this site is
 * unconfirmed, and a field that does not exist cannot imply a download.
 */
export type QualityDocument = {
  name: string;
  scope: string | null;
};

export type QualityDocumentation = {
  /** The band's own label — localized CMS copy, never a code string. See `QualityApproach`. */
  eyebrow: string | null;
  heading: string | null;
  lead: string | null;
  registerLabel: string | null;
  documents: QualityDocument[];
  /** The line that keeps the register from reading as a download list. */
  note: string | null;
};

/**
 * The sampling policy, and the exact scope it is confirmed for.
 *
 * `families` carries **keys only** — never a label, never a path. `apps/web` resolves each against
 * the canonical Product Family table; an unknown key is dropped by the API before it is served, and
 * dropped again by the frontend if one somehow survives. When nothing resolves, the section is not
 * rendered: the policy published without its scope is a broader promise than the documentation
 * makes.
 */
export type QualitySampling = {
  eyebrow: string | null;
  /** The policy itself. Rendered as the section's own heading — there is no separate heading. */
  statement: string;
  familiesLabel: string | null;
  families: ProductFamilyKey[];
  limit: string | null;
};

export type QualityClosing = {
  eyebrow: string | null;
  heading: string | null;
  lead: string | null;
  primaryCta: ContentCta | null;
  routes: ContentCta[];
};

/**
 * The Quality & Certifications page's editorial content, from
 * `GET /content/globals/quality-certifications`.
 *
 * ── The hardest constraint on this page, on the wire ────────────────────────
 *
 * Nothing in this type can carry a certificate, standard, licence, accreditation, issuing body,
 * certificate number, validity date or mark; a test method designation, a test condition or a
 * numerical result; a capacity, market or customer. Several of those have no field at all — absent
 * rather than empty.
 *
 * ── Sections below the hero are nullable ────────────────────────────────────
 *
 * A section with no content is `null` and is not rendered, so the page can be published in stages.
 * The hero is not optional: `hero.title` is the page's H1, and a Global that has none is reported as
 * unavailable rather than served headless.
 *
 * ── Nothing here is Payload-shaped ──────────────────────────────────────────
 *
 * No document id, no `_status`, no `globalType`, no timestamps, no version metadata, no rich-text
 * AST, no expanded media record. `apps/web` cannot tell this came from a CMS.
 */
export type QualityCertificationsContent = {
  hero: QualityCertificationsHero;
  approach: QualityApproach | null;
  laboratory: QualityLaboratory | null;
  certifications: QualityCertificationsSection | null;
  documentation: QualityDocumentation | null;
  sampling: QualitySampling | null;
  closing: QualityClosing | null;
  /**
   * `alternates` is always empty: `/quality-certifications` is a structural route whose URL is
   * identical in every locale, so its `hreflang` set is the platform's `Locale` table rather than a
   * CMS translation state (PROJECT_HANDOFF.md §6.12).
   */
  seo: SeoFields;
};

/** `GET /content/globals/quality-certifications`. */
export type QualityCertificationsResponse = ContentGlobalResponse<QualityCertificationsContent>;
