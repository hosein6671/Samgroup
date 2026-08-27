import { Test } from "@nestjs/testing";

import { ApiException } from "../../common/http/api.exception";
import { ErrorCode } from "../../common/http/error-code";
import { AboutUsService } from "./about-us.service";
import { PayloadClient } from "./payload.client";

import type { ResolvedLocale } from "../../common/locale/resolved-locale";
import type { AboutUsContent, AboutUsResponse } from "@sam-group/types";

const EN: ResolvedLocale = { code: "en", defaultCode: "en", isDefault: true };
const FA: ResolvedLocale = { code: "fa", defaultCode: "en", isDefault: false };

/**
 * A published document as Payload actually answers it — including everything the wire must not
 * carry: the document id, `_status`, `globalType`, timestamps, the rich-text AST, and a media
 * upload expanded into its full record.
 */
const PUBLISHED_DOC = {
  id: 1,
  globalType: "about-us",
  _status: "published",
  createdAt: "2026-08-20T09:00:00.000Z",
  updatedAt: "2026-08-20T09:30:00.000Z",
  hero: {
    eyebrow: "VERIFICATION",
    title: "VERIFICATION HERO TITLE",
    supportingText: "VERIFICATION SUPPORTING TEXT",
    primaryCta: { label: "VERIFICATION PRIMARY", route: "products" },
    secondaryCta: { label: "VERIFICATION SECONDARY", route: "contact-us" },
    image: {
      id: 7,
      url: "/media/cms/verification.png",
      alt: "VERIFICATION ALT",
      width: 1600,
      height: 900,
      filename: "verification.png",
      mimeType: "image/png",
      filesize: 12345,
      prefix: "cms",
      updatedAt: "2026-08-20T09:00:00.000Z",
    },
    imageCaption: "VERIFICATION CAPTION",
  },
  whoWeAre: {
    heading: "VERIFICATION WHO WE ARE",
    body: { root: { children: [] } },
    bodyHtml: "<p>VERIFICATION BODY</p>",
    positions: [{ id: "a1", term: "VERIFICATION TERM", note: "VERIFICATION NOTE" }],
    image: null,
    imageCaption: null,
  },
  expertise: {
    heading: "VERIFICATION EXPERTISE",
    lead: "VERIFICATION EXPERTISE LEAD",
    items: [{ id: "b1", name: "VERIFICATION AREA" }],
  },
  team: {
    eyebrow: "VERIFICATION TEAM",
    heading: "VERIFICATION TEAM HEADING",
    lead: "VERIFICATION TEAM LEAD",
    functions: [
      { id: "team-1", name: "VERIFICATION FUNCTION", note: "VERIFICATION FUNCTION NOTE" },
    ],
    image: null,
    imageCaption: null,
  },
  qualityStandards: {
    heading: "VERIFICATION QUALITY",
    lead: "VERIFICATION QUALITY LEAD",
    items: [{ id: "c1", name: "VERIFICATION COMMITMENT", note: "" }],
    footnote: "VERIFICATION FOOTNOTE",
    footnoteCta: { label: "VERIFICATION FOOTNOTE LINK", route: "quality-certifications" },
    image: null,
    imageCaption: null,
  },
  closing: {
    eyebrow: "VERIFICATION NEXT",
    heading: "VERIFICATION CLOSING",
    lead: "VERIFICATION CLOSING LEAD",
    primaryCta: { label: "VERIFICATION QUOTE", route: "request-a-quote" },
    routes: [{ id: "d1", label: "VERIFICATION ROUTE", route: "customized-solutions" }],
  },
  seo: { metaTitle: "VERIFICATION META", robotsIndex: true },
};

type Harness = {
  service: AboutUsService;
  findGlobal: jest.Mock;
};

async function createHarness(): Promise<Harness> {
  const findGlobal = jest.fn().mockResolvedValue(PUBLISHED_DOC);

  const moduleRef = await Test.createTestingModule({
    providers: [AboutUsService, { provide: PayloadClient, useValue: { findGlobal } }],
  }).compile();

  return { service: moduleRef.get(AboutUsService), findGlobal };
}

/**
 * Narrows an available response to its content, failing the test when it is not available.
 *
 * Every assertion about the projection needs the content, and the availability flag is the thing
 * that decides whether there is any — so unwrapping it here keeps each test asserting one thing
 * while still failing loudly if the service reports the page unpublished.
 */
function expectAvailable(response: AboutUsResponse): AboutUsContent {
  expect(response.available).toBe(true);

  if (!response.available) {
    throw new Error("expected an available response");
  }

  return response.content;
}

/** The same assertion `content-pages.service.spec.ts` makes, awaiting the rejection first. */
async function expectApiError(
  work: Promise<unknown>,
  code: ErrorCode,
  status: number,
): Promise<void> {
  const error: unknown = await work.then(
    () => new Error("the call resolved, but was expected to reject"),
    (rejection: unknown) => rejection,
  );

  expect(error).toBeInstanceOf(ApiException);
  expect((error as ApiException).code).toBe(code);
  expect((error as ApiException).getStatus()).toBe(status);
}

describe("AboutUsService", () => {
  describe("the published projection", () => {
    it("serves the page, and nothing Payload added to it", async () => {
      const { service } = await createHarness();

      const { response } = await service.find(EN);
      const content = expectAvailable(response);

      expect(content.hero.title).toBe("VERIFICATION HERO TITLE");
      expect(content.whoWeAre?.positions).toEqual([
        { term: "VERIFICATION TERM", note: "VERIFICATION NOTE" },
      ]);
      expect(content.expertise?.items).toEqual([{ name: "VERIFICATION AREA" }]);
      expect(content.team?.functions).toEqual([
        { name: "VERIFICATION FUNCTION", note: "VERIFICATION FUNCTION NOTE" },
      ]);
      expect(content.closing?.routes).toEqual([
        { label: "VERIFICATION ROUTE", route: "customized-solutions" },
      ]);

      /*
       * The leak assertion, on the serialized response rather than on a field list: an id, a
       * status, a timestamp or a rich-text AST smuggled into any nested position fails here, which
       * a per-property check would not catch.
       */
      const wire = JSON.stringify(content);

      for (const forbidden of [
        '"id"',
        '"_status"',
        '"globalType"',
        '"createdAt"',
        '"updatedAt"',
        '"root"',
        '"filename"',
        '"mimeType"',
        '"filesize"',
        '"prefix"',
      ]) {
        expect(wire).not.toContain(forbidden);
      }
    });

    it("reduces an upload to a URL, alt text and dimensions", async () => {
      const { service } = await createHarness();

      const { response } = await service.find(EN);
      const content = expectAvailable(response);

      expect(content.hero.figure).toEqual({
        image: {
          url: "/media/cms/verification.png",
          alt: "VERIFICATION ALT",
          width: 1600,
          height: 900,
        },
        caption: "VERIFICATION CAPTION",
      });
    });

    it("asks Payload for the requested locale, with uploads expanded", async () => {
      const { service, findGlobal } = await createHarness();

      await service.find(EN);

      expect(findGlobal).toHaveBeenCalledWith("about-us", { locale: "en", depth: "1" });
    });

    it("never asks for drafts", async () => {
      const { service, findGlobal } = await createHarness();

      await service.find(FA);

      for (const [, query] of findGlobal.mock.calls) {
        expect(query).not.toHaveProperty("draft");
      }
    });
  });

  describe("optional sections", () => {
    it("omits a section the editor has not written", async () => {
      const { service, findGlobal } = await createHarness();

      findGlobal.mockResolvedValue({
        hero: { title: "VERIFICATION HERO TITLE" },
        expertise: { heading: "", lead: null, items: [] },
        team: { heading: "", lead: null, functions: [] },
        qualityStandards: {},
        closing: { routes: [] },
        whoWeAre: { bodyHtml: "", positions: [] },
      });

      const { response } = await service.find(EN);
      const content = expectAvailable(response);

      expect(content.whoWeAre).toBeNull();
      expect(content.expertise).toBeNull();
      expect(content.team).toBeNull();
      expect(content.qualityStandards).toBeNull();
      expect(content.closing).toBeNull();
      expect(content.hero.title).toBe("VERIFICATION HERO TITLE");
      expect(content.hero.figure).toBeNull();
    });

    it("drops an incomplete call to action rather than rendering a button to nowhere", async () => {
      const { service, findGlobal } = await createHarness();

      findGlobal.mockResolvedValue({
        hero: {
          title: "VERIFICATION HERO TITLE",
          primaryCta: { label: "VERIFICATION", route: null },
          secondaryCta: { label: null, route: "products" },
        },
      });

      const { response } = await service.find(EN);
      const content = expectAvailable(response);

      expect(content.hero.primaryCta).toBeNull();
      expect(content.hero.secondaryCta).toBeNull();
    });

    it("drops a route key it cannot resolve", async () => {
      const { service, findGlobal } = await createHarness();

      findGlobal.mockResolvedValue({
        hero: {
          title: "VERIFICATION HERO TITLE",
          primaryCta: { label: "VERIFICATION", route: "a-route-from-a-newer-schema" },
        },
      });

      const { response } = await service.find(EN);
      const content = expectAvailable(response);

      expect(content.hero.primaryCta).toBeNull();
    });
  });

  describe("unpublished", () => {
    /**
     * Payload answers `200 {}` both when a Global has never been published and when the service
     * identity's published-only constraint excludes it. Both are the same fact for a consumer:
     * there is no published About page.
     *
     * **It is not NOT_FOUND**, and these tests are what hold that line. `about-us` is a resource
     * this API serves; only an editor's publish is outstanding. Reporting it as a missing resource
     * would make it indistinguishable from a Global name the API has never heard of, and would put
     * a 404 in front of `apps/web` that it must then be trusted never to act on.
     */
    it("reports an empty document as unavailable, not as NOT_FOUND", async () => {
      const { service, findGlobal } = await createHarness();

      findGlobal.mockResolvedValue({});

      const { response } = await service.find(EN);

      expect(response).toEqual({ available: false, content: null });
    });

    it("reports a document with no heading the same way", async () => {
      const { service, findGlobal } = await createHarness();

      findGlobal.mockResolvedValue({ hero: { title: "   " }, closing: { heading: "x" } });

      const { response } = await service.find(EN);

      expect(response.available).toBe(false);
    });

    it("never passes Payload's raw empty document through", async () => {
      const { service, findGlobal } = await createHarness();

      findGlobal.mockResolvedValue({});

      const { response } = await service.find(EN);

      // `{}` is the CMS's answer; `available: false` is this application's statement about it.
      expect(Object.keys(response).sort()).toEqual(["available", "content"]);
      expect(response.content).toBeNull();
    });

    it("claims no locale fallback for a page that served nothing", async () => {
      const { service, findGlobal } = await createHarness();

      findGlobal.mockResolvedValue({});

      const { localeFallback } = await service.find(FA);

      expect(localeFallback).toBe(false);
      // And it does not spend a second read establishing the fallback state of absent content.
      expect(findGlobal).toHaveBeenCalledTimes(1);
    });
  });

  describe("locale fallback", () => {
    it("does not ask twice for the default locale", async () => {
      const { service, findGlobal } = await createHarness();

      const { localeFallback } = await service.find(EN);

      expect(localeFallback).toBe(false);
      expect(findGlobal).toHaveBeenCalledTimes(1);
    });

    it("reports a fallback when the requested locale has no heading of its own", async () => {
      const { service, findGlobal } = await createHarness();

      findGlobal.mockImplementation((_slug: string, query: Record<string, string>) =>
        Promise.resolve(
          query["fallback-locale"] === "none" ? { hero: { title: "" } } : PUBLISHED_DOC,
        ),
      );

      const { response, localeFallback } = await service.find(FA);
      const content = expectAvailable(response);

      expect(localeFallback).toBe(true);
      // The served content is still the complete document, not the untranslated one.
      expect(content.hero.title).toBe("VERIFICATION HERO TITLE");
    });

    it("reports no fallback when the requested locale is translated", async () => {
      const { service, findGlobal } = await createHarness();

      findGlobal.mockImplementation((_slug: string, query: Record<string, string>) =>
        Promise.resolve(
          query["fallback-locale"] === "none"
            ? { hero: { title: "عنوان راستی‌آزمایی" } }
            : { ...PUBLISHED_DOC, hero: { ...PUBLISHED_DOC.hero, title: "عنوان راستی‌آزمایی" } },
        ),
      );

      const { response, localeFallback } = await service.find(FA);
      const content = expectAvailable(response);

      expect(localeFallback).toBe(false);
      expect(content.hero.title).toBe("عنوان راستی‌آزمایی");
    });
  });

  describe("upstream failure", () => {
    it("is passed through untouched — it is never a 404", async () => {
      const { service, findGlobal } = await createHarness();

      findGlobal.mockRejectedValue(
        new ApiException(503, ErrorCode.UpstreamUnavailable, "The content service is unavailable."),
      );

      await expectApiError(service.find(EN), ErrorCode.UpstreamUnavailable, 503);
    });
  });
});
