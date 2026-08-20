import { Test } from "@nestjs/testing";

import { ApiException } from "../../common/http/api.exception";
import { ErrorCode } from "../../common/http/error-code";
import { LocaleResolutionService } from "../../common/locale/locale-resolution.service";
import { AboutUsService } from "./about-us.service";
import { ContentGlobalsController } from "./content-globals.controller";

import type { ResolvedLocale } from "../../common/locale/resolved-locale";
import type { AboutUsContent } from "@sam-group/types";

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

type Harness = {
  controller: ContentGlobalsController;
  find: jest.Mock;
  resolve: jest.Mock;
};

async function createHarness(): Promise<Harness> {
  const find = jest
    .fn()
    .mockResolvedValue({ response: { available: true, content: CONTENT }, localeFallback: false });
  const resolve = jest.fn().mockResolvedValue(EN);

  const moduleRef = await Test.createTestingModule({
    controllers: [ContentGlobalsController],
    providers: [
      { provide: AboutUsService, useValue: { find } },
      { provide: LocaleResolutionService, useValue: { resolve } },
    ],
  }).compile();

  return { controller: moduleRef.get(ContentGlobalsController), find, resolve };
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
    const { controller, find, resolve } = await createHarness();

    const error: unknown = await controller.findOne("home", {}).then(
      () => null,
      (rejection: unknown) => rejection,
    );

    expect(error).toBeInstanceOf(ApiException);
    expect((error as ApiException).code).toBe(ErrorCode.NotFound);
    expect((error as ApiException).getStatus()).toBe(404);
    expect(find).not.toHaveBeenCalled();
    expect(resolve).not.toHaveBeenCalled();
  });
});
