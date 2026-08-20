import { Test } from "@nestjs/testing";

import { ApiException } from "../../common/http/api.exception";
import { ErrorCode } from "../../common/http/error-code";
import { LocaleResolutionService } from "../../common/locale/locale-resolution.service";
import { AboutUsService } from "./about-us.service";
import { ContentGlobalsController } from "./content-globals.controller";
import { CustomizedSolutionsService } from "./customized-solutions.service";

import type { ResolvedLocale } from "../../common/locale/resolved-locale";
import type { AboutUsContent, CustomizedSolutionsContent } from "@sam-group/types";

const EN: ResolvedLocale = { code: "en", defaultCode: "en", isDefault: true };
const FA: ResolvedLocale = { code: "fa", defaultCode: "en", isDefault: false };

const CONTENT: AboutUsContent = {
  hero: {
    eyebrow: null,
    title: "VERIFICATION HERO TITLE",
    supportingText: null,
    primaryCta: null,
    secondaryCta: null,
    figure: null,
  },
  whoWeAre: null,
  expertise: null,
  qualityStandards: null,
  closing: null,
  seo: {
    locale: "en",
    metaTitle: null,
    metaDescription: null,
    canonicalUrl: null,
    ogTitle: null,
    ogDescription: null,
    socialImage: null,
    twitterCardType: "summary_large_image",
    twitterTitle: null,
    twitterDescription: null,
    twitterImage: null,
    robotsIndex: true,
    robotsFollow: true,
    keywords: [],
    structuredDataOverride: null,
    alternates: [],
  },
};

const SOLUTIONS: CustomizedSolutionsContent = {
  hero: {
    eyebrow: null,
    title: "VERIFICATION SOLUTIONS TITLE",
    supportingText: null,
    requestCta: null,
    routeCta: null,
  },
  introduction: null,
  process: null,
  seo: CONTENT.seo,
};

type Harness = {
  controller: ContentGlobalsController;
  find: jest.Mock;
  findSolutions: jest.Mock;
  resolve: jest.Mock;
};

async function createHarness(): Promise<Harness> {
  const find = jest
    .fn()
    .mockResolvedValue({ response: { available: true, content: CONTENT }, localeFallback: false });
  const findSolutions = jest.fn().mockResolvedValue({
    response: { available: true, content: SOLUTIONS },
    localeFallback: false,
  });
  const resolve = jest.fn().mockResolvedValue(EN);

  const moduleRef = await Test.createTestingModule({
    controllers: [ContentGlobalsController],
    providers: [
      { provide: AboutUsService, useValue: { find } },
      { provide: CustomizedSolutionsService, useValue: { find: findSolutions } },
      { provide: LocaleResolutionService, useValue: { resolve } },
    ],
  }).compile();

  return { controller: moduleRef.get(ContentGlobalsController), find, findSolutions, resolve };
}

describe("ContentGlobalsController", () => {
  it("serves the About Us Global under the contract's own path", async () => {
    const { controller } = await createHarness();

    const response = await controller.findOne("about-us", {});

    expect(response.data).toEqual({ available: true, content: CONTENT });
    expect(response.meta).toEqual({});
  });

  it("resolves the requested locale before reading", async () => {
    const { controller, resolve, find } = await createHarness();
    resolve.mockResolvedValue(FA);

    await controller.findOne("about-us", { locale: "fa" });

    expect(resolve).toHaveBeenCalledWith("fa");
    expect(find).toHaveBeenCalledWith(FA);
  });

  it("reports a locale fallback in meta, and only when there is one", async () => {
    const { controller, find } = await createHarness();
    find.mockResolvedValue({
      response: { available: true, content: CONTENT },
      localeFallback: true,
    });

    const response = await controller.findOne("about-us", { locale: "ar" });

    expect(response.meta).toEqual({ localeFallback: true });
  });

  /**
   * ── The three conditions, and why they must stay three ────────────────────
   *
   * A name the API does not serve, a Global with nothing published, and a CMS that did not answer
   * are three different facts, and each one implies a different thing for the reader. Collapsing
   * any pair of them would hand `apps/web` a single signal it could only guess at — and the guess
   * that matters is the one that would put a canonical 404 on a corporate URL.
   */
  it("answers 200 with `available: false` for a recognised but unpublished global", async () => {
    const { controller, find } = await createHarness();
    find.mockResolvedValue({
      response: { available: false, content: null },
      localeFallback: false,
    });

    const response = await controller.findOne("about-us", {});

    expect(response.data).toEqual({ available: false, content: null });
    expect(response.meta).toEqual({});
  });

  it("lets an upstream failure through as itself, never as a 404", async () => {
    const { controller, find } = await createHarness();
    find.mockRejectedValue(
      new ApiException(503, ErrorCode.UpstreamUnavailable, "The content service is unavailable."),
    );

    const error: unknown = await controller.findOne("about-us", {}).then(
      () => null,
      (rejection: unknown) => rejection,
    );

    expect((error as ApiException).code).toBe(ErrorCode.UpstreamUnavailable);
    expect((error as ApiException).getStatus()).toBe(503);
  });

  it("404s an unimplemented global without touching the CMS", async () => {
    const { controller, find, findSolutions, resolve } = await createHarness();

    const error: unknown = await controller.findOne("home", {}).then(
      () => null,
      (rejection: unknown) => rejection,
    );

    expect(error).toBeInstanceOf(ApiException);
    expect((error as ApiException).code).toBe(ErrorCode.NotFound);
    expect((error as ApiException).getStatus()).toBe(404);
    expect(find).not.toHaveBeenCalled();
    expect(findSolutions).not.toHaveBeenCalled();
    expect(resolve).not.toHaveBeenCalled();
  });

  describe("dispatch", () => {
    it("serves the Customized Solutions Global under the same path", async () => {
      const { controller } = await createHarness();

      const response = await controller.findOne("customized-solutions", {});

      expect(response.data).toEqual({ available: true, content: SOLUTIONS });
    });

    it("sends each name to its own service and to no other", async () => {
      const { controller, find, findSolutions } = await createHarness();

      await controller.findOne("customized-solutions", {});

      expect(findSolutions).toHaveBeenCalledTimes(1);
      expect(find).not.toHaveBeenCalled();
    });

    it("gives the second Global the same unpublished semantics as the first", async () => {
      const { controller, findSolutions } = await createHarness();
      findSolutions.mockResolvedValue({
        response: { available: false, content: null },
        localeFallback: false,
      });

      const response = await controller.findOne("customized-solutions", {});

      expect(response.data).toEqual({ available: false, content: null });
    });

    /**
     * A dispatch table keyed by request input is a prototype-pollution shape if it is read
     * carelessly: `__proto__`, `constructor` and `toString` are all "present" on a plain object.
     * Only own properties count as recognised names.
     */
    it("recognises no name it was not given", async () => {
      const { controller } = await createHarness();

      for (const name of ["__proto__", "constructor", "toString", "hasOwnProperty", ""]) {
        const error: unknown = await controller.findOne(name, {}).then(
          () => null,
          (rejection: unknown) => rejection,
        );

        expect((error as ApiException).getStatus()).toBe(404);
      }
    });
  });
});
