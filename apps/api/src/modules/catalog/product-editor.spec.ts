import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { ProductEditorialEdit } from "./product-editor.dto";
import { ProductEditorService } from "./product-editor.service";
import type { PrismaService } from "../../prisma/prisma.service";
import type { SeoService } from "../seo/seo.service";
import type { AuditService } from "../audit/audit.service";

const content = {
  name: "Product",
  description: "Editorial description",
  seo: { robotsIndex: true, robotsFollow: true, keywords: [] },
};
describe("product editorial boundary", () => {
  it("rejects technical fields, missing nested content and unsafe canonical schemes", async () => {
    for (const input of [
      { revision: 0, action: "publish" },
      { revision: 0, action: "publish", content: [content] },
      { revision: 0, action: "publish", content: { ...content, name: "   " } },
      { revision: 0, action: "publish", content: { ...content, seo: [content.seo] } },
      { revision: 0, action: "publish", content: { ...content, specifications: [] } },
      {
        revision: 0,
        action: "publish",
        content: { ...content, seo: { ...content.seo, canonicalUrl: "javascript:alert(1)" } },
      },
    ])
      expect(
        (
          await validate(plainToInstance(ProductEditorialEdit, input), {
            whitelist: true,
            forbidNonWhitelisted: true,
          })
        ).length,
      ).toBeGreaterThan(0);
  });
  it("accepts bounded ordinary content", async () => {
    expect(
      await validate(
        plainToInstance(ProductEditorialEdit, { revision: 0, action: "save-draft", content }),
        { whitelist: true, forbidNonWhitelisted: true },
      ),
    ).toEqual([]);
  });
  for (const action of ["save-draft", "publish"] as const)
    it(`${action} records activity in the same transaction`, async () => {
      const tx = {
        product: {
          findUnique: jest.fn().mockResolvedValue({ slug: "product", editorialDraft: null }),
          update: jest.fn(),
        },
        productEditorialDraft: { upsert: jest.fn() },
      };
      const prisma = {
        $transaction: jest.fn(async (work: (value: typeof tx) => Promise<unknown>) => work(tx)),
      };
      const seo = { publishProductEditorial: jest.fn() };
      const audit = { append: jest.fn() };
      const service = new ProductEditorService(
        prisma as unknown as PrismaService,
        seo as unknown as SeoService,
        audit as unknown as AuditService,
      );
      expect(await service.save("id", "actor", { revision: 0, action, content })).toEqual({
        revision: "1",
        slug: "product",
      });
      expect(audit.append).toHaveBeenCalledWith(
        expect.objectContaining({ actorId: "actor", subjectId: "id" }),
        tx,
      );
      expect(tx.product.update).toHaveBeenCalledTimes(action === "publish" ? 1 : 0);
      expect(seo.publishProductEditorial).toHaveBeenCalledTimes(action === "publish" ? 1 : 0);
    });
  it("refuses a stale editor without writing", async () => {
    const tx = {
      product: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ slug: "product", editorialDraft: { revision: 2 } }),
      },
      productEditorialDraft: { upsert: jest.fn() },
    };
    const prisma = {
      $transaction: async (work: (value: typeof tx) => Promise<unknown>) => work(tx),
    };
    const service = new ProductEditorService(
      prisma as unknown as PrismaService,
      {} as SeoService,
      {} as AuditService,
    );
    await expect(
      service.save("id", "actor", { revision: 1, action: "publish", content }),
    ).rejects.toMatchObject({ status: 409 });
    expect(tx.productEditorialDraft.upsert).not.toHaveBeenCalled();
  });
});
