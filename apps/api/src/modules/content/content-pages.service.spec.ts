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
  find: jest.Mock;
};

async function createHarness(): Promise<Harness> {
  const find = jest.fn();

  const moduleRef = await Test.createTestingModule({
    providers: [ContentPagesService, { provide: PayloadClient, useValue: { find } }],
  }).compile();

  return { service: moduleRef.get(ContentPagesService), find };
}

function expectApiError(error: unknown, code: ErrorCode, status: number): void {
  expect(error).toBeInstanceOf(ApiException);
  expect((error as ApiException).code).toBe(code);
  expect((error as ApiException).getStatus()).toBe(status);
}

describe("ContentPagesService", () => {
  it("serves the four public fields and nothing else", async () => {
    const { service, find } = await createHarness();
    find.mockResolvedValue({ docs: [EN_DOC] });

    const { page, localeFallback } = await service.findBySlug(SLUG, EN);

    // An allow-list, asserted as one: Payload's id, its rich-text AST, its draft status and its
    // own timestamps must not reach the wire.
    expect(page).toEqual({
      slug: SLUG,
      title: EN_DOC.title,
      bodyHtml: EN_DOC.bodyHtml,
      lastUpdatedDate: EN_DOC.lastUpdatedDate,
    });
    expect(localeFallback).toBe(false);
  });

  it("never asks Payload for drafts, and pins depth and limit", async () => {
    const { service, find } = await createHarness();
    find.mockResolvedValue({ docs: [EN_DOC] });

    await service.findBySlug(SLUG, EN);

    const [collection, query] = find.mock.calls[0] as [string, Record<string, string>];

    expect(collection).toBe("pages");
    expect(query).toMatchObject({
      "where[slug][equals]": SLUG,
      depth: "0",
      limit: "1",
      locale: "en",
      "fallback-locale": "none",
    });
    expect(query).not.toHaveProperty("draft");
  });

  it("issues one request for a fully translated locale", async () => {
    const { service, find } = await createHarness();
    find.mockResolvedValue({ docs: [EN_DOC] });

    await service.findBySlug(SLUG, EN);

    expect(find).toHaveBeenCalledTimes(1);
  });

  it("reports localeFallback and serves the fallen-back document for an untranslated locale", async () => {
    const { service, find } = await createHarness();
    find
      .mockResolvedValueOnce({ docs: [FA_UNTRANSLATED_DOC] })
      .mockResolvedValueOnce({ docs: [EN_DOC] });

    const { page, localeFallback } = await service.findBySlug(SLUG, FA);

    expect(localeFallback).toBe(true);
    expect(page.title).toBe(EN_DOC.title);

    // The second request drops `fallback-locale=none` — that is what turns fallback back on.
    const [, second] = find.mock.calls[1] as [string, Record<string, string>];
    expect(second.locale).toBe("fa");
    expect(second).not.toHaveProperty("fallback-locale");
  });

  it("answers NOT_FOUND when the CMS answered and holds no published page", async () => {
    const { service, find } = await createHarness();
    find.mockResolvedValue({ docs: [] });

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
    const { service, find } = await createHarness();
    const unavailable = new ApiException(503, ErrorCode.UpstreamUnavailable, "unavailable");
    find.mockRejectedValue(unavailable);

    await service.findBySlug(SLUG, EN).then(
      () => {
        throw new Error("expected a rejection");
      },
      (error: unknown) => expectApiError(error, ErrorCode.UpstreamUnavailable, 503),
    );
  });

  it("reports UPSTREAM_UNAVAILABLE when the fallback read contradicts the strict one", async () => {
    const { service, find } = await createHarness();
    find.mockResolvedValueOnce({ docs: [FA_UNTRANSLATED_DOC] }).mockResolvedValueOnce({ docs: [] });

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
    const { service, find } = await createHarness();
    find
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
    const { service, find } = await createHarness();
    find.mockResolvedValue({
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
    const { service, find } = await createHarness();
    // A body made entirely of markup the sanitizer strips. It is PRESENT in the CMS, so this locale
    // is translated — treating the empty sanitized output as "untranslated" would send the service
    // off to fetch a fallback that does not exist and report a fallback that did not happen.
    find.mockResolvedValue({ docs: [{ ...EN_DOC, bodyHtml: "<script>alert(1)</script>" }] });

    const { page, localeFallback } = await service.findBySlug(SLUG, EN);

    expect(find).toHaveBeenCalledTimes(1);
    expect(localeFallback).toBe(false);
    expect(page.bodyHtml).toBe("");
  });

  it("serves null for an unset lastUpdatedDate rather than inventing one", async () => {
    const { service, find } = await createHarness();
    find.mockResolvedValue({ docs: [{ ...EN_DOC, lastUpdatedDate: null }] });

    const { page } = await service.findBySlug(SLUG, EN);

    expect(page.lastUpdatedDate).toBeNull();
  });
});
