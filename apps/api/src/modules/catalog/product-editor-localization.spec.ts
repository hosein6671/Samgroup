import { ProductEditorLocalizationService } from "./product-editor-localization.service";

import type { ContentTranslationService } from "../../common/content/content-translation.service";
import type { PrismaService } from "../../prisma/prisma.service";
import type { AuditService } from "../audit/audit.service";
import type { SeoService } from "../seo/seo.service";

const seoInput = { robotsIndex: true, robotsFollow: true, keywords: [] };
const content = {
  name: "Attempted rename",
  description: "توضیح",
  applications: [{ title: "کاربرد", description: "شرح" }],
  seo: seoInput,
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- a test harness whose inferred shape is the point
function harness(
  current: { revision: number; content?: unknown; translationStatus?: string } | null,
) {
  const tx = {
    product: {
      findUnique: jest.fn().mockResolvedValue({
        name: "CK-4 10W-40",
        slug: "ck-4-10w-40",
        editorialLocalizations: current ? [current] : [],
      }),
      update: jest.fn(),
    },
    productEditorialLocalization: { upsert: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn(async (work: (value: typeof tx) => Promise<unknown>) => work(tx)),
  };
  const seo = { publishProductEditorial: jest.fn() };
  const audit = { append: jest.fn() };
  const translations = { publishField: jest.fn() };
  const service = new ProductEditorLocalizationService(
    prisma as unknown as PrismaService,
    seo as unknown as SeoService,
    audit as unknown as AuditService,
    translations as unknown as ContentTranslationService,
  );
  return { tx, prisma, seo, audit, translations, service };
}

describe("ProductEditorLocalizationService.save (ADR-027 §3)", () => {
  it("publishes the locale's description, sections and SEO, never the product's own columns", async () => {
    const { tx, seo, audit, translations, service } = harness(null);
    expect(
      await service.save("p1", "fa", "actor", { revision: 0, action: "publish", content }),
    ).toEqual({ revision: "1", slug: "ck-4-10w-40" });
    expect(tx.product.update).not.toHaveBeenCalled();
    const upsert = tx.productEditorialLocalization.upsert.mock.calls[0][0];
    expect(upsert.where).toEqual({ productId_locale: { productId: "p1", locale: "fa" } });
    expect(upsert.create.content.name).toBe("CK-4 10W-40");
    expect(upsert.create.publishedSections.applications).toEqual(content.applications);
    expect(upsert.create.translationStatus).toBe("MACHINE_DRAFT");
    expect(translations.publishField).toHaveBeenCalledWith(
      "Product",
      "p1",
      "fa",
      "description",
      "توضیح",
      "MACHINE_DRAFT",
      tx,
    );
    expect(seo.publishProductEditorial).toHaveBeenCalledWith("p1", seoInput, tx, "fa");
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({ event: "product.localization_published", subjectId: "p1" }),
      tx,
    );
  });

  it("saves a draft without publishing anything", async () => {
    const { tx, seo, translations, audit, service } = harness({ revision: 3, content: {} });
    await service.save("p1", "fa", "actor", { revision: 3, action: "save-draft", content });
    const upsert = tx.productEditorialLocalization.upsert.mock.calls[0][0];
    expect(upsert.update.revision).toBe(4);
    expect(upsert.update).not.toHaveProperty("publishedSections");
    expect(translations.publishField).not.toHaveBeenCalled();
    expect(seo.publishProductEditorial).not.toHaveBeenCalled();
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({ event: "product.localization_draft_saved" }),
      tx,
    );
  });

  it("keeps the stored review state unless one is given", async () => {
    const kept = harness({ revision: 1, translationStatus: "HUMAN_REVIEWED" });
    await kept.service.save("p1", "fa", "a", { revision: 1, action: "publish", content });
    expect(
      kept.tx.productEditorialLocalization.upsert.mock.calls[0][0].update.translationStatus,
    ).toBe("HUMAN_REVIEWED");
    const set = harness({ revision: 1, translationStatus: "HUMAN_REVIEWED" });
    await set.service.save("p1", "fa", "a", {
      revision: 1,
      action: "publish",
      translationStatus: "machine_draft",
      content,
    });
    expect(
      set.tx.productEditorialLocalization.upsert.mock.calls[0][0].update.translationStatus,
    ).toBe("MACHINE_DRAFT");
  });

  it("refuses a stale revision without writing", async () => {
    const { tx, service } = harness({ revision: 2 });
    await expect(
      service.save("p1", "fa", "a", { revision: 1, action: "publish", content }),
    ).rejects.toMatchObject({ status: 409 });
    expect(tx.productEditorialLocalization.upsert).not.toHaveBeenCalled();
  });

  it("maps a serialization failure to a conflict", async () => {
    const { prisma, service } = harness(null);
    prisma.$transaction.mockRejectedValueOnce(Object.assign(new Error("x"), { code: "P2034" }));
    await expect(
      service.save("p1", "fa", "a", { revision: 0, action: "publish", content }),
    ).rejects.toMatchObject({ status: 409 });
  });
});
