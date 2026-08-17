import { Test } from "@nestjs/testing";

import { ApiException } from "../../common/http/api.exception";
import { ErrorCode } from "../../common/http/error-code";
import { ContentPagesService } from "./content-pages.service";
import { PayloadClient } from "./payload.client";

import type { ResolvedLocale } from "../../common/locale/resolved-locale";

const EN: ResolvedLocale = { code: "en", defaultCode: "en", isDefault: true };
const FA: ResolvedLocale = { code: "fa", defaultCode: "en", isDefault: false };

const SLUG = "cms-demo-page";

const EN_DOC = {
  id: 1,
  slug: SLUG,
  title: "CMS Demo Page",
  bodyHtml: "<p>DEMO / PLACEHOLDER / NON-AUTHORITATIVE.</p>",
  lastUpdatedDate: "2026-08-16T00:00:00.000Z",
  _status: "published",
  body: { root: { children: [] } },
  updatedAt: "2026-08-16T00:00:00.000Z",
};

/** What Payload returns for `fa` with `fallback-locale=none` while no translation exists. */
const FA_UNTRANSLATED_DOC = {
  id: 1,
  slug: SLUG,
  bodyHtml: "",
  lastUpdatedDate: "2026-08-16T00:00:00.000Z",
  _status: "published",
};

type Harness = {
  service: ContentPagesService;
  /** The mock the service actually receives — for asserting the queries it sends. */
  find: jest.Mock;
  /** The per-locale page read. This is what a test configures to shape the document. */
  pageRead: jest.Mock;
  /** The `locale=all` read that derives `seo.alternates`. Defaults to "translated in en only". */
  alternates: jest.Mock;
};

/**
 * The service makes two different reads, so the harness routes them to two mocks.
 *
 * Without the split, a `mockResolvedValue` meant for the page read would also answer the alternates
 * query, and every test would silently assert against a document standing in for two unrelated
 * shapes. `locale=all` is the discriminator because it is the one thing that distinguishes them on
 * the wire.
 */
async function createHarness(): Promise<Harness> {
  const pageRead = jest.fn();
  const alternates = jest.fn().mockResolvedValue({ docs: [{ title: { en: "CMS Demo Page" } }] });

  const find = jest.fn((collection: string, query: Record<string, string>) =>
    query.locale === "all" ? alternates(collection, query) : pageRead(collection, query),
  );

  const moduleRef = await Test.createTestingModule({
    providers: [ContentPagesService, { provide: PayloadClient, useValue: { find } }],
  }).compile();

  return { service: moduleRef.get(ContentPagesService), find, pageRead, alternates };
}

function expectApiError(error: unknown, code: ErrorCode, status: number): void {
  expect(error).toBeInstanceOf(ApiException);
  expect((error as ApiException).code).toBe(code);
  expect((error as ApiException).getStatus()).toBe(status);
}

describe("ContentPagesService", () => {
  it("serves the public fields and nothing else", async () => {
    const { service, pageRead } = await createHarness();
    pageRead.mockResolvedValue({ docs: [EN_DOC] });

    const { page, localeFallback } = await service.findBySlug(SLUG, EN);

    // An allow-list, asserted as one: Payload's id, its rich-text AST, its draft status and its
    // own timestamps must not reach the wire. `toEqual` rather than `toMatchObject` is the whole
    // point — a field added to the collection tomorrow fails this test instead of leaking.
    expect(Object.keys(page).sort()).toEqual([
      "bodyHtml",
      "lastUpdatedDate",
      "seo",
      "slug",
      "title",
    ]);
    expect(page).toMatchObject({
      slug: SLUG,
      title: EN_DOC.title,
      bodyHtml: EN_DOC.bodyHtml,
      lastUpdatedDate: EN_DOC.lastUpdatedDate,
    });
    expect(localeFallback).toBe(false);
  });

  it("always carries a full seo record, even for a page with no SEO values", async () => {
    const { service, pageRead } = await createHarness();
    // EN_DOC has no `seo` key at all — the state of a page whose editor never opened the tab.
    pageRead.mockResolvedValue({ docs: [EN_DOC] });

    const { page } = await service.findBySlug(SLUG, EN);

    expect(page.seo.locale).toBe("en");
    expect(page.seo.metaTitle).toBeNull();
    // Defaults, not absences: `generateMetadata` must never have to test for the object first.
    expect(page.seo.robotsIndex).toBe(true);
    expect(page.seo.robotsFollow).toBe(true);
    expect(page.seo.twitterCardType).toBe("summary_large_image");
    expect(page.seo.socialImage).toBeNull();
    expect(page.seo.twitterImage).toBeNull();
  });

  it("resolves the social image to url/alt/dimensions and leaks nothing else about the media record", async () => {
    const { service, pageRead } = await createHarness();
    pageRead.mockResolvedValue({
      docs: [
        {
          ...EN_DOC,
          seo: {
            metaTitle: "Demo",
            socialImage: {
              id: 2,
              url: "/media/cms/demo.png",
              alt: "A grey rectangle.",
              width: 1200,
              height: 630,
              filename: "demo.png",
              prefix: "cms",
              mimeType: "image/png",
              filesize: 3629,
              focalX: 50,
            },
          },
        },
      ],
    });

    const { page } = await service.findBySlug(SLUG, EN);

    expect(page.seo.metaTitle).toBe("Demo");
    // The alt text (§Image SEO) and dimensions (§6) travel with the URL; the storage details
    // beside them in the same Payload document do not.
    expect(page.seo.socialImage).toEqual({
      url: "/media/cms/demo.png",
      alt: "A grey rectangle.",
      width: 1200,
      height: 630,
    });
    expect(page.seo.twitterImage).toEqual(page.seo.socialImage);

    const serialized = JSON.stringify(page);

    for (const internal of ["filename", "prefix", "mimeType", "filesize", "focalX"]) {
      expect(serialized).not.toContain(internal);
    }
  });

  it("derives alternates from the locales that actually hold a translation", async () => {
    const { service, pageRead, alternates } = await createHarness();
    pageRead.mockResolvedValue({ docs: [EN_DOC] });
    // `fa` is present but empty — an editor opened it and saved nothing. That is not a translation,
    // and emitting an hreflang for it would point search engines at fallback content.
    alternates.mockResolvedValue({
      docs: [{ title: { en: "CMS Demo Page", fa: "", ar: "صفحه" } }],
    });

    const { page } = await service.findBySlug(SLUG, EN);

    expect(page.seo.alternates).toEqual([
      { locale: "en", slug: SLUG },
      { locale: "ar", slug: SLUG },
    ]);
  });

  it("asks for alternates with locale=all and depth 0, and never for drafts", async () => {
    const { service, find, pageRead } = await createHarness();
    pageRead.mockResolvedValue({ docs: [EN_DOC] });

    await service.findBySlug(SLUG, EN);

    const all = find.mock.calls.find(
      (call) => (call[1] as Record<string, string>).locale === "all",
    );

    expect(all).toBeDefined();
    expect(all?.[1]).toMatchObject({ "where[slug][equals]": SLUG, depth: "0", limit: "1" });
    expect(all?.[1]).not.toHaveProperty("draft");
  });

  it("serves empty alternates when the upstream shape is unusable, without failing the page", async () => {
    const { service, pageRead, alternates } = await createHarness();
    pageRead.mockResolvedValue({ docs: [EN_DOC] });

    for (const broken of [{ docs: [] }, { docs: [{}] }, { docs: [{ title: "a string" }] }]) {
      alternates.mockResolvedValue(broken);

      const { page } = await service.findBySlug(SLUG, EN);

      // A missing hreflang set degrades the page; it does not break it. The page itself was read
      // successfully and must still be served.
      expect(page.seo.alternates).toEqual([]);
      expect(page.title).toBe(EN_DOC.title);
    }
  });

  it("lets an alternates failure surface as the upstream failure it is", async () => {
    const { service, pageRead, alternates } = await createHarness();
    pageRead.mockResolvedValue({ docs: [EN_DOC] });
    alternates.mockRejectedValue(
      new ApiException(503, ErrorCode.UpstreamUnavailable, "unavailable"),
    );

    // Swallowing this into an empty list would make "no alternates" and "we could not find out"
    // the same answer, and the first legitimately means a page exists in one locale only.
    await service.findBySlug(SLUG, EN).then(
      () => {
        throw new Error("expected a rejection");
      },
      (error: unknown) => expectApiError(error, ErrorCode.UpstreamUnavailable, 503),
    );
  });

  it("never asks Payload for drafts, and pins depth and limit", async () => {
    const { service, find, pageRead } = await createHarness();
    pageRead.mockResolvedValue({ docs: [EN_DOC] });

    await service.findBySlug(SLUG, EN);

    const [collection, query] = find.mock.calls[0] as [string, Record<string, string>];

    expect(collection).toBe("pages");
    expect(query).toMatchObject({
      "where[slug][equals]": SLUG,
      depth: "1",
      limit: "1",
      locale: "en",
      "fallback-locale": "none",
    });
    expect(query).not.toHaveProperty("draft");
  });

  it("issues one request for a fully translated locale", async () => {
    const { service, find, pageRead } = await createHarness();
    pageRead.mockResolvedValue({ docs: [EN_DOC] });

    await service.findBySlug(SLUG, EN);

    expect(pageRead).toHaveBeenCalledTimes(1);
  });

  it("reports localeFallback and serves the fallen-back document for an untranslated locale", async () => {
    const { service, find, pageRead } = await createHarness();
    pageRead
      .mockResolvedValueOnce({ docs: [FA_UNTRANSLATED_DOC] })
      .mockResolvedValueOnce({ docs: [EN_DOC] });

    const { page, localeFallback } = await service.findBySlug(SLUG, FA);

    expect(localeFallback).toBe(true);
    expect(page.title).toBe(EN_DOC.title);

    // The second PAGE request drops `fallback-locale=none` — that is what turns fallback back on.
    // Selected by predicate rather than by index: the alternates read also sits in this list, and an
    // index would bind the test to the order of two unrelated queries.
    const pageQueries = find.mock.calls
      .map((call) => call[1] as Record<string, string>)
      .filter((query) => query.locale !== "all");

    expect(pageQueries).toHaveLength(2);
    expect(pageQueries[0]).toMatchObject({ locale: "fa", "fallback-locale": "none" });
    expect(pageQueries[1]?.locale).toBe("fa");
    expect(pageQueries[1]).not.toHaveProperty("fallback-locale");
  });

  it("answers NOT_FOUND when the CMS answered and holds no published page", async () => {
    const { service, find, pageRead } = await createHarness();
    pageRead.mockResolvedValue({ docs: [] });

    await service.findBySlug("nope", EN).then(
      () => {
        throw new Error("expected a rejection");
      },
      (error: unknown) => {
        expectApiError(error, ErrorCode.NotFound, 404);
        // The slug is caller-supplied text and must not be reflected into a displayable message.
        expect((error as ApiException).message).not.toContain("nope");
      },
    );
  });

  it("propagates UPSTREAM_UNAVAILABLE and never converts it into a 404", async () => {
    const { service, find, pageRead } = await createHarness();
    const unavailable = new ApiException(503, ErrorCode.UpstreamUnavailable, "unavailable");
    pageRead.mockRejectedValue(unavailable);

    await service.findBySlug(SLUG, EN).then(
      () => {
        throw new Error("expected a rejection");
      },
      (error: unknown) => expectApiError(error, ErrorCode.UpstreamUnavailable, 503),
    );
  });

  it("reports UPSTREAM_UNAVAILABLE when the fallback read contradicts the strict one", async () => {
    const { service, find, pageRead } = await createHarness();
    pageRead
      .mockResolvedValueOnce({ docs: [FA_UNTRANSLATED_DOC] })
      .mockResolvedValueOnce({ docs: [] });

    await service.findBySlug(SLUG, FA).then(
      () => {
        throw new Error("expected a rejection");
      },
      // A CMS that changes its answer between two requests is a fault, not an absence. Answering
      // 404 here would let an upstream inconsistency delete a page.
      (error: unknown) => expectApiError(error, ErrorCode.UpstreamUnavailable, 503),
    );
  });

  it("reports UPSTREAM_UNAVAILABLE when even the default locale has no value", async () => {
    const { service, find, pageRead } = await createHarness();
    pageRead
      .mockResolvedValueOnce({ docs: [FA_UNTRANSLATED_DOC] })
      .mockResolvedValueOnce({ docs: [FA_UNTRANSLATED_DOC] });

    await service.findBySlug(SLUG, FA).then(
      () => {
        throw new Error("expected a rejection");
      },
      (error: unknown) => expectApiError(error, ErrorCode.UpstreamUnavailable, 503),
    );
  });

  it("sanitizes bodyHtml on the way out, so no response can carry raw editor markup", async () => {
    const { service, find, pageRead } = await createHarness();
    pageRead.mockResolvedValue({
      docs: [
        {
          ...EN_DOC,
          bodyHtml:
            '<p onclick="steal()">Clause 1</p><script>alert(1)</script><p><a href="javascript:alert(1)">link</a></p>',
        },
      ],
    });

    const { page } = await service.findBySlug(SLUG, EN);

    // The sanitizer has its own exhaustive suite; this asserts the SERVICE is wired to it, which is
    // the part that makes it a boundary rather than a helper somebody has to remember to call.
    expect(page.bodyHtml).not.toContain("<script");
    expect(page.bodyHtml).not.toContain("onclick");
    expect(page.bodyHtml).not.toContain("javascript:");
    expect(page.bodyHtml).not.toContain("alert(1)");
    expect(page.bodyHtml).toContain("Clause 1");
  });

  it("decides locale fallback on the RAW body, not the sanitized one", async () => {
    const { service, find, pageRead } = await createHarness();
    // A body made entirely of markup the sanitizer strips. It is PRESENT in the CMS, so this locale
    // is translated — treating the empty sanitized output as "untranslated" would send the service
    // off to fetch a fallback that does not exist and report a fallback that did not happen.
    pageRead.mockResolvedValue({ docs: [{ ...EN_DOC, bodyHtml: "<script>alert(1)</script>" }] });

    const { page, localeFallback } = await service.findBySlug(SLUG, EN);

    expect(pageRead).toHaveBeenCalledTimes(1);
    expect(localeFallback).toBe(false);
    expect(page.bodyHtml).toBe("");
  });

  it("serves null for an unset lastUpdatedDate rather than inventing one", async () => {
    const { service, find, pageRead } = await createHarness();
    pageRead.mockResolvedValue({ docs: [{ ...EN_DOC, lastUpdatedDate: null }] });

    const { page } = await service.findBySlug(SLUG, EN);

    expect(page.lastUpdatedDate).toBeNull();
  });
});
