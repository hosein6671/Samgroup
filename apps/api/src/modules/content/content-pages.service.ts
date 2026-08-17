import { HttpStatus, Injectable } from "@nestjs/common";

import { ApiException } from "../../common/http/api.exception";
import { ErrorCode } from "../../common/http/error-code";
// A value import, not `import type`: emitDecoratorMetadata writes constructor parameter types into
// design:paramtypes at runtime, and a type-only import erases to nothing.
import { PayloadClient } from "./payload.client";
import { sanitizeRichTextHtml } from "./rich-text.sanitizer";
import { normalizeSeo } from "./seo.normalizer";

import type { ContentPageResponse } from "./dto/content-page.response";
import type { ResolvedLocale } from "../../common/locale/resolved-locale";
import type { SeoAlternate } from "@sam-group/types";

/**
 * Reads of the Payload `Pages` collection — the Legal Pages collection, and only that.
 *
 * ── Published-only, twice over ──────────────────────────────────────────────
 *
 * API_CONTRACT_FINAL.md §4 makes published-state filtering NestJS's responsibility and forbids
 * honouring `?draft=true` from a public request. This service therefore never sends `draft`, and
 * Payload's own access control additionally constrains the service identity to published documents
 * (`apps/cms/src/access.ts`). Either one alone would be enough; both together mean a bug in this
 * file cannot surface an unpublished page.
 *
 * ── Absence and unavailability never converge ───────────────────────────────
 *
 * A 404 from this service means one thing: the CMS answered, and no published page carries that
 * slug. Everything else — an unconfigured CMS, a refused connection, a timeout, a 5xx, a rejected
 * API key, a body that is not a Payload response — is 503 UPSTREAM_UNAVAILABLE, thrown by
 * `PayloadClient` before this file ever sees it. That is ADR-010 §7's principle, and the reason
 * `PayloadClient.find` returns an empty list rather than throwing on one.
 */

const PAGES_COLLECTION = "pages";

const NOT_FOUND_MESSAGE = "No page was found for the requested slug.";

/**
 * A 2xx from Payload carrying something that is not a page.
 *
 * Reported as UPSTREAM_UNAVAILABLE and never as NOT_FOUND, for the same reason `apps/web`'s blog
 * client refuses to: a broken contract must not be able to delete a page.
 */
const MALFORMED_MESSAGE = "The content service returned an unusable response.";

/**
 * Whether a page carries a body at all, measured on the RAW value.
 *
 * This is why the locale-fallback check reads `bodyHtml` before sanitization: a body consisting only
 * of markup the sanitizer strips would come out as `""` and be indistinguishable from an
 * untranslated field, sending the service off to fetch a fallback that does not exist. Presence is a
 * fact about the CMS document; safety is a fact about what leaves this process. They are separate
 * questions and are asked separately.
 */

export type ContentPageResult = {
  readonly page: ContentPageResponse;
  /** True when any localized field was served in the default locale instead of the requested one. */
  readonly localeFallback: boolean;
};

@Injectable()
export class ContentPagesService {
  constructor(private readonly payload: PayloadClient) {}

  /**
   * One published page by slug, in the requested locale.
   *
   * ── How `localeFallback` is established ─────────────────────────────────
   *
   * Payload is configured with `fallback: true`, which serves the default locale's value for an
   * untranslated field — and says nothing about having done so. API_CONTRACT_FINAL.md §3 requires
   * the response to report it, so it is measured rather than inferred:
   *
   * 1. Ask with `fallback-locale=none`. Untranslated fields come back absent.
   * 2. If every localized field is present, that locale is fully translated. One request, done.
   * 3. If any is missing, ask again with fallback on and serve *that* document, reporting
   *    `localeFallback`. Payload's fallback fills only the untranslated fields, so a partially
   *    translated page keeps its real translations — which is why the second response is taken
   *    whole rather than merged field by field here.
   *
   * The default locale never needs the second request: `fallback-locale=none` in the default locale
   * returns exactly what a fallback would have produced.
   *
   * @throws ApiException NOT_FOUND (404) when the CMS answered and holds no published page for the
   *   slug; UPSTREAM_UNAVAILABLE (503) for every infrastructure and contract failure.
   */
  async findBySlug(slug: string, locale: ResolvedLocale): Promise<ContentPageResult> {
    const strict = await this.findOne(slug, { locale: locale.code, "fallback-locale": "none" });

    if (strict === null) {
      // The slug is caller-supplied text and §8 contracts `message` as safe to display, so it is
      // not echoed back.
      throw new ApiException(HttpStatus.NOT_FOUND, ErrorCode.NotFound, NOT_FOUND_MESSAGE);
    }

    /*
     * `alternates` is derived, not stored — which locales a page is genuinely translated into is a
     * fact about the documents, and INTERNATIONALIZATION_STRATEGY.md §4 requires untranslated
     * locales be omitted rather than pointed at a fallback. Its own request because the primary read
     * cannot answer it: a per-locale read sees one locale, and `locale=all` cannot replace it —
     * `bodyHtml` is computed per resolved locale and comes back empty under it.
     */
    const alternates = await this.findAlternates(slug);

    if (isFullyTranslated(strict)) {
      return { page: toResponse(strict, slug, locale.code, alternates), localeFallback: false };
    }

    const fallen = await this.findOne(slug, { locale: locale.code });

    if (fallen === null) {
      /*
       * The strict read found the document and the fallback read did not. Nothing about content
       * explains that — it is the CMS changing its answer between two requests — so it is reported
       * as an upstream fault rather than as a 404 the first read already contradicted.
       */
      throw new ApiException(
        HttpStatus.SERVICE_UNAVAILABLE,
        ErrorCode.UpstreamUnavailable,
        MALFORMED_MESSAGE,
      );
    }

    if (!isFullyTranslated(fallen)) {
      // Fallback is configured on; a field still missing after it means the default locale itself
      // has no value, which the collection's `required` constraints are supposed to prevent.
      throw new ApiException(
        HttpStatus.SERVICE_UNAVAILABLE,
        ErrorCode.UpstreamUnavailable,
        MALFORMED_MESSAGE,
      );
    }

    return { page: toResponse(fallen, slug, locale.code, alternates), localeFallback: true };
  }

  /**
   * The single matching document, or null when the collection holds none.
   *
   * `depth=1`, not 0. It expands exactly one level, which is what turns the SEO group's upload
   * references into documents carrying a `url` — at depth 0 they are bare ids, and an id is not
   * something this API can serve. One level and no more: a relationship to a relationship would
   * arrive uninvited, and the response is built by allow-list precisely so nothing reaches the wire
   * without someone writing it there.
   */
  private async findOne(
    slug: string,
    localeQuery: Readonly<Record<string, string>>,
  ): Promise<Record<string, unknown> | null> {
    const { docs } = await this.payload.find(PAGES_COLLECTION, {
      "where[slug][equals]": slug,
      depth: "1",
      limit: "1",
      ...localeQuery,
    });

    return docs[0] ?? null;
  }

  /**
   * Every locale this page is genuinely translated into.
   *
   * `locale=all` makes Payload return each localized field as an object keyed by locale, **omitting
   * locales with no stored value** — so the keys of `title` are exactly the translated set. `depth=0`
   * because nothing here needs a relationship expanded.
   *
   * The slug is the same in every locale (PROJECT_HANDOFF.md §6.12, structural URLs stay fixed
   * English), so each alternate carries the requested slug rather than a per-locale one. When
   * localized slugs eventually arrive for products and articles, their own module supplies them —
   * `SeoAlternate` already carries a slug per locale for that reason.
   *
   * A failure here is an upstream failure and propagates as one; it is never silently swallowed into
   * an empty list, because "no alternates" and "we could not find out" would then be the same
   * answer, and the first of those legitimately means a page exists in one locale only.
   */
  private async findAlternates(slug: string): Promise<SeoAlternate[]> {
    const { docs } = await this.payload.find(PAGES_COLLECTION, {
      "where[slug][equals]": slug,
      depth: "0",
      limit: "1",
      locale: "all",
    });

    const title = docs[0]?.title;

    if (typeof title !== "object" || title === null) {
      return [];
    }

    return Object.entries(title as Record<string, unknown>)
      .filter(([, value]) => isNonEmptyString(value))
      .map(([code]) => ({ locale: code, slug }));
  }
}

/** The localized fields this endpoint serves, both of which must be present in a given locale. */
function isFullyTranslated(doc: Record<string, unknown>): boolean {
  return isNonEmptyString(doc.title) && isNonEmptyString(doc.bodyHtml);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value !== "";
}

/**
 * Payload's document reduced to the four public fields.
 *
 * An allow-list rather than a spread with deletions: a field added to the collection tomorrow —
 * an internal note, an editorial flag, an unreleased draft field — reaches the wire only when
 * someone writes it here.
 *
 * `slug` is taken from the request rather than from the document. The lookup matched on equality,
 * so they agree by construction, and using the request value keeps the response's identity
 * independent of a field Payload could later decide to transform.
 *
 * **`bodyHtml` is sanitized here, and this is the only place it is.** Every path out of this service
 * goes through this function, so no response can be assembled that skips it — which is the property
 * that makes the sanitizer a boundary rather than a helper someone has to remember to call.
 * `title` needs no sanitizing: it is a `text` field, it is never rendered as markup, and React
 * escapes it.
 */
function toResponse(
  doc: Record<string, unknown>,
  slug: string,
  locale: string,
  alternates: readonly SeoAlternate[],
): ContentPageResponse {
  return {
    slug,
    title: typeof doc.title === "string" ? doc.title : "",
    bodyHtml: sanitizeRichTextHtml(doc.bodyHtml),
    lastUpdatedDate: typeof doc.lastUpdatedDate === "string" ? doc.lastUpdatedDate : null,
    /*
     * Always present, never omitted. A page whose editor never opened the SEO tab produces a record
     * of nulls with the documented defaults rather than a missing key, so `apps/web` applies the
     * fallback chain against one shape instead of testing for the object first.
     */
    seo: normalizeSeo(doc.seo, locale, alternates),
  };
}
