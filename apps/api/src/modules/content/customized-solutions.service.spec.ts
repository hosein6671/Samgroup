import { Test } from "@nestjs/testing";

import { ApiException } from "../../common/http/api.exception";
import { ErrorCode } from "../../common/http/error-code";
import { CustomizedSolutionsService } from "./customized-solutions.service";
import { PayloadClient } from "./payload.client";

import type { ResolvedLocale } from "../../common/locale/resolved-locale";
import type { CustomizedSolutionsContent, CustomizedSolutionsResponse } from "@sam-group/types";

const EN: ResolvedLocale = { code: "en", defaultCode: "en", isDefault: true };
const FA: ResolvedLocale = { code: "fa", defaultCode: "en", isDefault: false };

/**
 * A published document as Payload actually answers it — including everything the wire must not
 * carry: the document id, `_status`, `globalType`, timestamps and the rich-text AST.
 */
const PUBLISHED_DOC = {
  id: 1,
  globalType: "customized-solutions",
  _status: "published",
  createdAt: "2026-08-20T09:00:00.000Z",
  updatedAt: "2026-08-20T09:30:00.000Z",
  hero: {
    eyebrow: "VERIFICATION EYEBROW",
    title: "VERIFICATION SOLUTIONS TITLE",
    supportingText: "VERIFICATION SUPPORTING TEXT",
    requestCta: { label: "VERIFICATION REQUEST ACTION" },
    routeCta: { label: "VERIFICATION ROUTE ACTION", route: "products" },
  },
  introduction: {
    heading: "VERIFICATION INTRO HEADING",
    body: { root: { children: [] } },
    bodyHtml: "<p>VERIFICATION INTRO BODY</p>",
  },
  process: {
    heading: "VERIFICATION PROCESS HEADING",
    lead: "VERIFICATION PROCESS LEAD",
    steps: [
      { id: "s1", name: "VERIFICATION STEP ONE" },
      { id: "s2", name: "VERIFICATION STEP TWO" },
    ],
  },
  seo: { metaTitle: "VERIFICATION META", robotsIndex: true },
};

type Harness = {
  service: CustomizedSolutionsService;
  findGlobal: jest.Mock;
};

async function createHarness(): Promise<Harness> {
  const findGlobal = jest.fn().mockResolvedValue(PUBLISHED_DOC);

  const moduleRef = await Test.createTestingModule({
    providers: [CustomizedSolutionsService, { provide: PayloadClient, useValue: { findGlobal } }],
  }).compile();

  return { service: moduleRef.get(CustomizedSolutionsService), findGlobal };
}

function expectAvailable(response: CustomizedSolutionsResponse): CustomizedSolutionsContent {
  expect(response.available).toBe(true);

  if (!response.available) {
    throw new Error("expected an available response");
  }

  return response.content;
}

describe("CustomizedSolutionsService", () => {
  describe("the published projection", () => {
    it("serves the page, and nothing Payload added to it", async () => {
      const { service } = await createHarness();

      const { response } = await service.find(EN);
      const content = expectAvailable(response);

      expect(content.hero.title).toBe("VERIFICATION SOLUTIONS TITLE");
      expect(content.introduction?.bodyHtml).toBe("<p>VERIFICATION INTRO BODY</p>");
      expect(content.process?.steps).toEqual([
        { name: "VERIFICATION STEP ONE" },
        { name: "VERIFICATION STEP TWO" },
      ]);

      const wire = JSON.stringify(content);

      for (const forbidden of [
        '"id"',
        '"_status"',
        '"globalType"',
        '"createdAt"',
        '"updatedAt"',
        '"root"',
      ]) {
        expect(wire).not.toContain(forbidden);
      }
    });

    it("reads the Global by its own slug, with uploads expanded", async () => {
      const { service, findGlobal } = await createHarness();

      await service.find(EN);

      expect(findGlobal).toHaveBeenCalledWith("customized-solutions", {
        locale: "en",
        depth: "1",
      });
    });

    it("never asks for drafts", async () => {
      const { service, findGlobal } = await createHarness();

      await service.find(FA);

      for (const [, query] of findGlobal.mock.calls) {
        expect(query).not.toHaveProperty("draft");
      }
    });
  });

  describe("the two kinds of action", () => {
    /**
     * The request action's destination is the page's, not the document's. The projection reads a
     * label and nothing else, so even a `route` or an `href` sitting in `sam_cms` cannot move where
     * that button goes.
     */
    it("projects the request action as a label, discarding any destination in the document", async () => {
      const { service, findGlobal } = await createHarness();

      findGlobal.mockResolvedValue({
        hero: {
          title: "VERIFICATION SOLUTIONS TITLE",
          requestCta: {
            label: "VERIFICATION REQUEST ACTION",
            route: "products",
            href: "https://example.invalid/hijacked",
            anchor: "somewhere-else",
          },
        },
      });

      const { response } = await service.find(EN);
      const content = expectAvailable(response);

      expect(content.hero.requestCta).toEqual({ label: "VERIFICATION REQUEST ACTION" });
      expect(JSON.stringify(content)).not.toContain("hijacked");
      expect(JSON.stringify(content)).not.toContain("somewhere-else");
    });

    it("drops an incomplete route action rather than rendering a button to nowhere", async () => {
      const { service, findGlobal } = await createHarness();

      findGlobal.mockResolvedValue({
        hero: {
          title: "VERIFICATION SOLUTIONS TITLE",
          routeCta: { label: "VERIFICATION", route: null },
        },
      });

      const { response } = await service.find(EN);

      expect(expectAvailable(response).hero.routeCta).toBeNull();
    });

    it("drops a route key it cannot resolve", async () => {
      const { service, findGlobal } = await createHarness();

      findGlobal.mockResolvedValue({
        hero: {
          title: "VERIFICATION SOLUTIONS TITLE",
          routeCta: { label: "VERIFICATION", route: "a-route-from-a-newer-schema" },
        },
      });

      const { response } = await service.find(EN);

      expect(expectAvailable(response).hero.routeCta).toBeNull();
    });

    it("omits an action the editor left empty", async () => {
      const { service, findGlobal } = await createHarness();

      findGlobal.mockResolvedValue({ hero: { title: "VERIFICATION SOLUTIONS TITLE" } });

      const { response } = await service.find(EN);
      const content = expectAvailable(response);

      expect(content.hero.requestCta).toBeNull();
      expect(content.hero.routeCta).toBeNull();
    });
  });

  describe("optional sections", () => {
    it("omits a section the editor has not written", async () => {
      const { service, findGlobal } = await createHarness();

      findGlobal.mockResolvedValue({
        hero: { title: "VERIFICATION SOLUTIONS TITLE" },
        introduction: { heading: "", bodyHtml: "" },
        process: { heading: null, lead: "", steps: [] },
      });

      const { response } = await service.find(EN);
      const content = expectAvailable(response);

      expect(content.introduction).toBeNull();
      expect(content.process).toBeNull();
      expect(content.hero.title).toBe("VERIFICATION SOLUTIONS TITLE");
    });

    it("keeps a step list even when its heading is unwritten", async () => {
      const { service, findGlobal } = await createHarness();

      findGlobal.mockResolvedValue({
        hero: { title: "VERIFICATION SOLUTIONS TITLE" },
        process: { steps: [{ name: "VERIFICATION STEP ONE" }, { name: "  " }] },
      });

      const { response } = await service.find(EN);
      const content = expectAvailable(response);

      // A blank row is dropped rather than rendered as an unnamed stage.
      expect(content.process?.steps).toEqual([{ name: "VERIFICATION STEP ONE" }]);
      expect(content.process?.heading).toBeNull();
    });
  });

  describe("unpublished", () => {
    it("reports an empty document as unavailable, not as NOT_FOUND", async () => {
      const { service, findGlobal } = await createHarness();

      findGlobal.mockResolvedValue({});

      const { response } = await service.find(EN);

      expect(response).toEqual({ available: false, content: null });
    });

    it("claims no locale fallback for a page that served nothing", async () => {
      const { service, findGlobal } = await createHarness();

      findGlobal.mockResolvedValue({});

      const { localeFallback } = await service.find(FA);

      expect(localeFallback).toBe(false);
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

      expect(localeFallback).toBe(true);
      // The served content is still the complete document, not the untranslated one.
      expect(expectAvailable(response).hero.title).toBe("VERIFICATION SOLUTIONS TITLE");
    });

    it("reports no fallback when the requested locale is translated", async () => {
      const { service, findGlobal } = await createHarness();

      findGlobal.mockImplementation((_slug: string, query: Record<string, string>) =>
        Promise.resolve(
          query["fallback-locale"] === "none"
            ? { hero: { title: "VERIFICATION TRANSLATED TITLE" } }
            : { ...PUBLISHED_DOC, hero: { title: "VERIFICATION TRANSLATED TITLE" } },
        ),
      );

      const { localeFallback } = await service.find(FA);

      expect(localeFallback).toBe(false);
    });
  });

  describe("upstream failure", () => {
    it("is passed through untouched — it is never a 404", async () => {
      const { service, findGlobal } = await createHarness();

      findGlobal.mockRejectedValue(
        new ApiException(503, ErrorCode.UpstreamUnavailable, "The content service is unavailable."),
      );

      const error: unknown = await service.find(EN).then(
        () => null,
        (rejection: unknown) => rejection,
      );

      expect(error).toBeInstanceOf(ApiException);
      expect((error as ApiException).code).toBe(ErrorCode.UpstreamUnavailable);
      expect((error as ApiException).getStatus()).toBe(503);
    });
  });

  /**
   * The ownership boundary, asserted on the response rather than on the schema.
   *
   * The Custom Product Request form is Prisma's and the API's. If a field name, an option or the
   * consent string from that form ever reaches this endpoint, the boundary has moved — and it would
   * move quietly, because the page would still look right.
   */
  describe("the form is not content", () => {
    it("serves nothing belonging to the request form, even when the document carries it", async () => {
      const { service, findGlobal } = await createHarness();

      findGlobal.mockResolvedValue({
        ...PUBLISHED_DOC,
        requestForm: {
          fields: [{ name: "companyName", label: "VERIFICATION FORM LABEL" }],
          consent: "VERIFICATION CONSENT",
          incoterms: ["EXW", "FOB"],
        },
      });

      const { response } = await service.find(EN);
      const wire = JSON.stringify(expectAvailable(response));

      for (const forbidden of ["companyName", "VERIFICATION FORM LABEL", "consent", "EXW"]) {
        expect(wire).not.toContain(forbidden);
      }
    });
  });
});
