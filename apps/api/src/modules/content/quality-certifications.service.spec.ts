import { Test } from "@nestjs/testing";

import { ApiException } from "../../common/http/api.exception";
import { ErrorCode } from "../../common/http/error-code";
import { PayloadClient } from "./payload.client";
import { QualityCertificationsService } from "./quality-certifications.service";

import type { ResolvedLocale } from "../../common/locale/resolved-locale";
import type { QualityCertificationsContent, QualityCertificationsResponse } from "@sam-group/types";

const EN: ResolvedLocale = { code: "en", defaultCode: "en", isDefault: true };
const FA: ResolvedLocale = { code: "fa", defaultCode: "en", isDefault: false };

/**
 * A published document as Payload actually answers it — including everything the wire must not
 * carry: the document id, `_status`, `globalType`, timestamps, and the whole expanded media record
 * behind the laboratory upload.
 */
const PUBLISHED_DOC = {
  id: 1,
  globalType: "quality-certifications",
  _status: "published",
  createdAt: "2026-08-20T09:00:00.000Z",
  updatedAt: "2026-08-20T09:30:00.000Z",
  hero: {
    eyebrow: "VERIFICATION EYEBROW",
    title: "VERIFICATION QUALITY TITLE",
    supportingText: "VERIFICATION SUPPORTING TEXT",
    indexLabel: "VERIFICATION INDEX LABEL",
    primaryCta: { label: "VERIFICATION PRIMARY", route: "contact-us" },
    secondaryCta: { label: "VERIFICATION SECONDARY", route: "products" },
  },
  approach: {
    eyebrow: "VERIFICATION APPROACH EYEBROW",
    heading: "VERIFICATION APPROACH HEADING",
    lead: "VERIFICATION APPROACH LEAD",
    stages: [
      { id: "s1", name: "VERIFICATION STAGE ONE", when: "VERIFICATION WHEN ONE" },
      { id: "s2", name: "VERIFICATION STAGE TWO", when: "VERIFICATION WHEN TWO" },
    ],
    footnote: "VERIFICATION APPROACH FOOTNOTE",
  },
  laboratory: {
    eyebrow: "VERIFICATION LAB EYEBROW",
    heading: "VERIFICATION LAB HEADING",
    lead: "VERIFICATION LAB LEAD",
    registerLabel: "VERIFICATION REGISTER LABEL",
    orderNote: "VERIFICATION ORDER NOTE",
    properties: [
      { id: "p1", name: "VERIFICATION PROPERTY ONE" },
      { id: "p2", name: "VERIFICATION PROPERTY TWO" },
    ],
    unpublishedHeading: "VERIFICATION UNPUBLISHED HEADING",
    unpublished: [{ id: "u1", name: "VERIFICATION WITHHELD", why: "VERIFICATION REASON" }],
    image: {
      id: 7,
      url: "/media/cms/verification-lab.png",
      alt: "VERIFICATION LAB ALT",
      width: 1600,
      height: 1000,
      filename: "verification-lab.png",
      mimeType: "image/png",
      filesize: 84321,
      prefix: "cms",
      createdAt: "2026-08-20T08:00:00.000Z",
    },
    imageCaption: "VERIFICATION LAB CAPTION",
  },
  certifications: {
    eyebrow: "VERIFICATION CERTS EYEBROW",
    heading: "VERIFICATION CERTS HEADING",
    status: "VERIFICATION WITHHELD STATUS",
    statement: "VERIFICATION CERTS STATEMENT",
    note: "VERIFICATION CERTS NOTE",
  },
  documentation: {
    eyebrow: "VERIFICATION DOCS EYEBROW",
    heading: "VERIFICATION DOCS HEADING",
    lead: "VERIFICATION DOCS LEAD",
    registerLabel: "VERIFICATION DOCS REGISTER",
    documents: [
      { id: "d1", name: "VERIFICATION DOCUMENT ONE", scope: "VERIFICATION SCOPE" },
      { id: "d2", name: "VERIFICATION DOCUMENT TWO" },
    ],
    note: "VERIFICATION DOCS NOTE",
  },
  sampling: {
    eyebrow: "VERIFICATION SAMPLING EYEBROW",
    statement: "VERIFICATION SAMPLING STATEMENT",
    familiesLabel: "VERIFICATION FAMILIES LABEL",
    families: ["base-oils", "engine-oils-automotive-lubricants"],
    limit: "VERIFICATION SAMPLING LIMIT",
  },
  closing: {
    eyebrow: "VERIFICATION CLOSING EYEBROW",
    heading: "VERIFICATION CLOSING HEADING",
    lead: "VERIFICATION CLOSING LEAD",
    primaryCta: { label: "VERIFICATION QUOTE", route: "request-a-quote" },
    routes: [{ id: "r1", label: "VERIFICATION ROUTE", route: "customized-solutions" }],
  },
  seo: { metaTitle: "VERIFICATION META", robotsIndex: true },
};

type Harness = {
  service: QualityCertificationsService;
  findGlobal: jest.Mock;
};

async function createHarness(): Promise<Harness> {
  const findGlobal = jest.fn().mockResolvedValue(PUBLISHED_DOC);

  const moduleRef = await Test.createTestingModule({
    providers: [QualityCertificationsService, { provide: PayloadClient, useValue: { findGlobal } }],
  }).compile();

  return { service: moduleRef.get(QualityCertificationsService), findGlobal };
}

function expectAvailable(response: QualityCertificationsResponse): QualityCertificationsContent {
  expect(response.available).toBe(true);

  if (!response.available) {
    throw new Error("expected an available response");
  }

  return response.content;
}

describe("QualityCertificationsService", () => {
  describe("the published projection", () => {
    it("serves the page, and nothing Payload added to it", async () => {
      const { service } = await createHarness();

      const { response } = await service.find(EN);
      const content = expectAvailable(response);

      expect(content.hero.title).toBe("VERIFICATION QUALITY TITLE");
      expect(content.approach?.stages).toEqual([
        { name: "VERIFICATION STAGE ONE", when: "VERIFICATION WHEN ONE" },
        { name: "VERIFICATION STAGE TWO", when: "VERIFICATION WHEN TWO" },
      ]);
      expect(content.documentation?.documents).toEqual([
        { name: "VERIFICATION DOCUMENT ONE", scope: "VERIFICATION SCOPE" },
        { name: "VERIFICATION DOCUMENT TWO", scope: null },
      ]);

      const wire = JSON.stringify(content);

      for (const forbidden of [
        '"id"',
        '"_status"',
        '"globalType"',
        '"createdAt"',
        '"updatedAt"',
        '"filename"',
        '"mimeType"',
        '"filesize"',
        '"prefix"',
        '"root"',
      ]) {
        expect(wire).not.toContain(forbidden);
      }
    });

    /**
     * The three eyebrows that were code-owned English until the eyebrow correction. They are now
     * ordinary localized CMS strings and must reach the wire like any other, so a Persian or Arabic
     * reader gets the label in their own language rather than in English.
     */
    it("serves every section's eyebrow from the document", async () => {
      const { service } = await createHarness();

      const { response } = await service.find(EN);
      const content = expectAvailable(response);

      expect(content.approach?.eyebrow).toBe("VERIFICATION APPROACH EYEBROW");
      expect(content.laboratory?.eyebrow).toBe("VERIFICATION LAB EYEBROW");
      expect(content.documentation?.eyebrow).toBe("VERIFICATION DOCS EYEBROW");
      expect(content.certifications?.eyebrow).toBe("VERIFICATION CERTS EYEBROW");
      expect(content.sampling?.eyebrow).toBe("VERIFICATION SAMPLING EYEBROW");
      expect(content.closing?.eyebrow).toBe("VERIFICATION CLOSING EYEBROW");
      expect(content.hero.eyebrow).toBe("VERIFICATION EYEBROW");
    });

    it("serves a null eyebrow rather than inventing one", async () => {
      const { service, findGlobal } = await createHarness();

      findGlobal.mockResolvedValue({
        hero: { title: "VERIFICATION QUALITY TITLE" },
        approach: { heading: "VERIFICATION APPROACH HEADING", eyebrow: "   " },
        laboratory: { heading: "VERIFICATION LAB HEADING" },
        documentation: { heading: "VERIFICATION DOCS HEADING" },
      });

      const { response } = await service.find(EN);
      const content = expectAvailable(response);

      expect(content.approach?.eyebrow).toBeNull();
      expect(content.laboratory?.eyebrow).toBeNull();
      expect(content.documentation?.eyebrow).toBeNull();
    });

    /**
     * An eyebrow is a label for a band. A band whose only content is its own label is a heading over
     * nothing, so it must not resurrect a section the editor has otherwise left empty — the same
     * rule `closing` already follows.
     */
    it("does not let an eyebrow alone keep an otherwise empty section alive", async () => {
      const { service, findGlobal } = await createHarness();

      findGlobal.mockResolvedValue({
        hero: { title: "VERIFICATION QUALITY TITLE" },
        approach: { eyebrow: "VERIFICATION APPROACH EYEBROW", stages: [] },
        laboratory: { eyebrow: "VERIFICATION LAB EYEBROW", properties: [] },
        documentation: { eyebrow: "VERIFICATION DOCS EYEBROW", documents: [] },
      });

      const { response } = await service.find(EN);
      const content = expectAvailable(response);

      expect(content.approach).toBeNull();
      expect(content.laboratory).toBeNull();
      expect(content.documentation).toBeNull();
    });

    it("reads the Global by its own slug, with uploads expanded", async () => {
      const { service, findGlobal } = await createHarness();

      await service.find(EN);

      expect(findGlobal).toHaveBeenCalledWith("quality-certifications", {
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

  /**
   * The certifications boundary, on the wire.
   *
   * The CMS schema cannot hold a certificate; this asserts that the projection cannot serve one
   * either, even if a field appeared in `sam_cms` from a schema newer than this code. The
   * projection names the five strings it reads, so anything else in the document is simply not
   * looked at.
   */
  describe("the certifications section can carry no certification", () => {
    it("serves five strings and no list", async () => {
      const { service } = await createHarness();

      const { response } = await service.find(EN);
      const section = expectAvailable(response).certifications;

      expect(Object.keys(section ?? {}).sort()).toEqual([
        "eyebrow",
        "heading",
        "note",
        "statement",
        "status",
      ]);
    });

    it("ignores a certificate list, issuer, number, date or file found in the document", async () => {
      const { service, findGlobal } = await createHarness();

      findGlobal.mockResolvedValue({
        hero: { title: "VERIFICATION QUALITY TITLE" },
        certifications: {
          statement: "VERIFICATION CERTS STATEMENT",
          items: [
            {
              certificateName: "SMUGGLED CERTIFICATE",
              issuingBody: "SMUGGLED ISSUER",
              certificateNumber: "SMUGGLED-0001",
              validUntil: "2030-01-01",
            },
          ],
          certificateFile: { url: "/media/cms/smuggled.pdf" },
          logo: { url: "/media/cms/smuggled-logo.png" },
        },
      });

      const { response } = await service.find(EN);
      const wire = JSON.stringify(expectAvailable(response));

      for (const forbidden of ["SMUGGLED", "certificateName", "issuingBody", "validUntil"]) {
        expect(wire).not.toContain(forbidden);
      }
    });

    it("reports the whole section absent when the editor has written none of it", async () => {
      const { service, findGlobal } = await createHarness();

      findGlobal.mockResolvedValue({
        hero: { title: "VERIFICATION QUALITY TITLE" },
        certifications: { eyebrow: "", heading: null, statement: "   " },
      });

      const { response } = await service.find(EN);

      expect(expectAvailable(response).certifications).toBeNull();
    });
  });

  /**
   * The laboratory register carries names and only names — the same guarantee the CMS schema makes,
   * restated where the wire is built.
   */
  describe("the laboratory register", () => {
    it("projects a property as a name, discarding anything else on the row", async () => {
      const { service, findGlobal } = await createHarness();

      findGlobal.mockResolvedValue({
        hero: { title: "VERIFICATION QUALITY TITLE" },
        laboratory: {
          properties: [
            {
              id: "p1",
              name: "VERIFICATION PROPERTY ONE",
              method: "SMUGGLED METHOD",
              typicalValue: "SMUGGLED VALUE",
              accreditation: "SMUGGLED ACCREDITATION",
              inHouse: true,
            },
            { id: "p2", name: "   " },
          ],
        },
      });

      const { response } = await service.find(EN);
      const content = expectAvailable(response);

      expect(content.laboratory?.properties).toEqual([{ name: "VERIFICATION PROPERTY ONE" }]);
      expect(JSON.stringify(content)).not.toContain("SMUGGLED");
    });

    it("normalizes the upload to four facts and no store detail", async () => {
      const { service } = await createHarness();

      const { response } = await service.find(EN);

      expect(expectAvailable(response).laboratory?.figure).toEqual({
        image: {
          url: "/media/cms/verification-lab.png",
          alt: "VERIFICATION LAB ALT",
          width: 1600,
          height: 1000,
        },
        caption: "VERIFICATION LAB CAPTION",
      });
    });

    it("serves no figure when no photograph is uploaded — a caption alone is not one", async () => {
      const { service, findGlobal } = await createHarness();

      findGlobal.mockResolvedValue({
        hero: { title: "VERIFICATION QUALITY TITLE" },
        laboratory: {
          heading: "VERIFICATION LAB HEADING",
          imageCaption: "VERIFICATION ORPHAN CAPTION",
        },
      });

      const { response } = await service.find(EN);

      expect(expectAvailable(response).laboratory?.figure).toBeNull();
    });

    it("keeps the withheld caveats, which are what stop the register reading as a claim", async () => {
      const { service } = await createHarness();

      const { response } = await service.find(EN);

      expect(expectAvailable(response).laboratory?.unpublished).toEqual([
        { name: "VERIFICATION WITHHELD", why: "VERIFICATION REASON" },
      ]);
    });
  });

  /**
   * The Product taxonomy boundary, enforced where the wire is built.
   *
   * Payload stores identifiers chosen from a closed list. This drops anything outside that list, so
   * a key from a schema newer than this file cannot reach a frontend that has nothing to resolve it
   * against — and a sampling section whose scope resolves to nothing is not served at all.
   */
  describe("sampling families are keys, allow-listed", () => {
    it("serves the selected keys and no label, path or product row", async () => {
      const { service } = await createHarness();

      const { response } = await service.find(EN);
      const sampling = expectAvailable(response).sampling;

      expect(sampling?.families).toEqual(["base-oils", "engine-oils-automotive-lubricants"]);
      expect(JSON.stringify(sampling)).not.toContain("/products/");
      expect(JSON.stringify(sampling)).not.toContain("Base Oils");
    });

    it("drops a key outside the six frozen identifiers", async () => {
      const { service, findGlobal } = await createHarness();

      findGlobal.mockResolvedValue({
        hero: { title: "VERIFICATION QUALITY TITLE" },
        sampling: {
          statement: "VERIFICATION SAMPLING STATEMENT",
          families: ["base-oils", "a-family-from-a-newer-schema", "", null, 7],
        },
      });

      const { response } = await service.find(EN);

      expect(expectAvailable(response).sampling?.families).toEqual(["base-oils"]);
    });

    it("collapses a duplicated key rather than rendering the family twice", async () => {
      const { service, findGlobal } = await createHarness();

      findGlobal.mockResolvedValue({
        hero: { title: "VERIFICATION QUALITY TITLE" },
        sampling: {
          statement: "VERIFICATION SAMPLING STATEMENT",
          families: ["base-oils", "base-oils"],
        },
      });

      const { response } = await service.find(EN);

      expect(expectAvailable(response).sampling?.families).toEqual(["base-oils"]);
    });

    it("omits the whole section when no key resolves — the policy is never served without scope", async () => {
      const { service, findGlobal } = await createHarness();

      findGlobal.mockResolvedValue({
        hero: { title: "VERIFICATION QUALITY TITLE" },
        sampling: {
          statement: "VERIFICATION SAMPLING STATEMENT",
          limit: "VERIFICATION SAMPLING LIMIT",
          families: ["a-family-from-a-newer-schema"],
        },
      });

      const { response } = await service.find(EN);
      const content = expectAvailable(response);

      expect(content.sampling).toBeNull();
      expect(JSON.stringify(content)).not.toContain("VERIFICATION SAMPLING STATEMENT");
    });

    it("omits the section when the policy statement itself is unwritten", async () => {
      const { service, findGlobal } = await createHarness();

      findGlobal.mockResolvedValue({
        hero: { title: "VERIFICATION QUALITY TITLE" },
        sampling: { familiesLabel: "VERIFICATION FAMILIES LABEL", families: ["base-oils"] },
      });

      const { response } = await service.find(EN);

      expect(expectAvailable(response).sampling).toBeNull();
    });
  });

  describe("the documentation register", () => {
    it("serves names and scopes, and cannot serve a link or a file", async () => {
      const { service, findGlobal } = await createHarness();

      findGlobal.mockResolvedValue({
        hero: { title: "VERIFICATION QUALITY TITLE" },
        documentation: {
          note: "VERIFICATION DOCS NOTE",
          documents: [
            {
              name: "VERIFICATION DOCUMENT ONE",
              href: "https://example.invalid/smuggled.pdf",
              file: { url: "/media/cms/smuggled.pdf" },
              access: "open",
            },
            { name: "  " },
          ],
        },
      });

      const { response } = await service.find(EN);
      const content = expectAvailable(response);

      expect(content.documentation?.documents).toEqual([
        { name: "VERIFICATION DOCUMENT ONE", scope: null },
      ]);
      expect(JSON.stringify(content)).not.toContain("smuggled");
      expect(JSON.stringify(content)).not.toContain("href");
    });

    it("keeps the note that stops the register reading as a download list", async () => {
      const { service } = await createHarness();

      const { response } = await service.find(EN);

      expect(expectAvailable(response).documentation?.note).toBe("VERIFICATION DOCS NOTE");
    });
  });

  describe("calls to action", () => {
    it("drops a route key it cannot resolve", async () => {
      const { service, findGlobal } = await createHarness();

      findGlobal.mockResolvedValue({
        hero: {
          title: "VERIFICATION QUALITY TITLE",
          primaryCta: { label: "VERIFICATION", route: "a-route-from-a-newer-schema" },
        },
      });

      const { response } = await service.find(EN);

      expect(expectAvailable(response).hero.primaryCta).toBeNull();
    });

    it("drops a stored URL — a destination is a key, never a path", async () => {
      const { service, findGlobal } = await createHarness();

      findGlobal.mockResolvedValue({
        hero: {
          title: "VERIFICATION QUALITY TITLE",
          primaryCta: {
            label: "VERIFICATION",
            route: "contact-us",
            href: "https://example.invalid/hijacked",
          },
        },
      });

      const { response } = await service.find(EN);
      const content = expectAvailable(response);

      expect(content.hero.primaryCta).toEqual({ label: "VERIFICATION", route: "contact-us" });
      expect(JSON.stringify(content)).not.toContain("hijacked");
    });
  });

  describe("optional sections", () => {
    it("omits a section the editor has not written", async () => {
      const { service, findGlobal } = await createHarness();

      findGlobal.mockResolvedValue({
        hero: { title: "VERIFICATION QUALITY TITLE" },
        approach: { heading: "", lead: null, stages: [] },
        laboratory: { heading: "   ", properties: [] },
        documentation: { documents: [] },
        closing: { routes: [] },
      });

      const { response } = await service.find(EN);
      const content = expectAvailable(response);

      expect(content.approach).toBeNull();
      expect(content.laboratory).toBeNull();
      expect(content.documentation).toBeNull();
      expect(content.closing).toBeNull();
      expect(content.hero.title).toBe("VERIFICATION QUALITY TITLE");
    });

    it("drops a stage that names no position, rather than rendering half of one", async () => {
      const { service, findGlobal } = await createHarness();

      findGlobal.mockResolvedValue({
        hero: { title: "VERIFICATION QUALITY TITLE" },
        approach: {
          stages: [
            { name: "VERIFICATION STAGE ONE", when: "VERIFICATION WHEN ONE" },
            { name: "VERIFICATION STAGE TWO", when: "" },
          ],
        },
      });

      const { response } = await service.find(EN);

      expect(expectAvailable(response).approach?.stages).toEqual([
        { name: "VERIFICATION STAGE ONE", when: "VERIFICATION WHEN ONE" },
      ]);
    });
  });

  describe("unpublished", () => {
    it("reports an empty document as unavailable, not as NOT_FOUND", async () => {
      const { service, findGlobal } = await createHarness();

      findGlobal.mockResolvedValue({});

      const { response } = await service.find(EN);

      expect(response).toEqual({ available: false, content: null });
    });

    it("reports a document with no heading as unavailable rather than serving it headless", async () => {
      const { service, findGlobal } = await createHarness();

      findGlobal.mockResolvedValue({ hero: { eyebrow: "VERIFICATION EYEBROW" } });

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
      expect(expectAvailable(response).hero.title).toBe("VERIFICATION QUALITY TITLE");
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
});
