import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../prisma/generated/client";
import type { PrismaService } from "../../prisma/prisma.service";
import type { ContentTranslationService } from "../../common/content/content-translation.service";
import { AuditService } from "../audit/audit.service";
import { SeoService } from "../seo/seo.service";
import { ProductEditorService } from "./product-editor.service";

const url = process.env["PRODUCT_EDITOR_TEST_DATABASE_URL"];
if (url && !/^\/sam_platform_disposable_[a-z0-9_]+$/.test(new URL(url).pathname))
  throw new Error("Product editor tests require a disposable database.");
(url ? describe : describe.skip)("product editorial transactions with PostgreSQL", () => {
  let client: PrismaClient;
  let service: ProductEditorService;
  let seo: SeoService;
  let productId: string;
  const actorId = randomUUID();
  const content = {
    name: "Edited example",
    description: "Edited description",
    seo: {
      metaTitle: "Editorial search title",
      robotsIndex: false,
      robotsFollow: true,
      keywords: ["example"],
    },
  };
  beforeAll(async () => {
    client = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
    const prisma = client as unknown as PrismaService;
    seo = new SeoService(prisma, {} as ContentTranslationService);
    service = new ProductEditorService(prisma, seo, new AuditService(prisma));
    await client.locale.upsert({
      where: { code: "en" },
      update: {},
      create: {
        code: "en",
        name: "English",
        nativeName: "English",
        direction: "LTR",
        sortOrder: 0,
      },
    });
    const category = await client.category.create({
      data: { name: "Disposable family", slug: `family-${randomUUID()}` },
    });
    const product = await client.product.create({
      data: {
        name: "Original",
        description: "Original description",
        slug: `product-${randomUUID()}`,
        categoryId: category.id,
      },
    });
    productId = product.id;
  });
  afterAll(async () => {
    await client.$disconnect();
  });
  it("keeps a draft private, publishes SEO atomically, and rejects stale saves", async () => {
    await service.save(productId, actorId, { revision: 0, action: "save-draft", content });
    expect((await client.product.findUniqueOrThrow({ where: { id: productId } })).name).toBe(
      "Original",
    );
    expect(await client.seoMeta.count({ where: { entityId: productId } })).toBe(0);
    await service.save(productId, actorId, { revision: 1, action: "publish", content });
    expect((await client.product.findUniqueOrThrow({ where: { id: productId } })).name).toBe(
      content.name,
    );
    expect(await seo.readProductEditorial(productId)).toMatchObject({
      metaTitle: content.seo.metaTitle,
      robotsIndex: false,
    });
    await expect(
      service.save(productId, actorId, { revision: 1, action: "publish", content }),
    ).rejects.toMatchObject({ status: 409 });
    expect(await client.adminAuditEvent.count({ where: { subjectId: productId } })).toBe(2);
    expect(await client.productCopy.count({ where: { productId } })).toBe(0);
  });
  it("rolls product, SEO and revision back if audit cannot be stored", async () => {
    const failing = new ProductEditorService(client as unknown as PrismaService, seo, {
      append: async () => {
        throw new Error("audit unavailable");
      },
    } as unknown as AuditService);
    await expect(
      failing.save(productId, actorId, {
        revision: 2,
        action: "publish",
        content: {
          ...content,
          name: "Must roll back",
          seo: { ...content.seo, metaTitle: "Must roll back" },
        },
      }),
    ).rejects.toThrow("audit unavailable");
    expect((await client.product.findUniqueOrThrow({ where: { id: productId } })).name).toBe(
      content.name,
    );
    expect(
      (await client.productEditorialDraft.findUniqueOrThrow({ where: { productId } })).revision,
    ).toBe(2);
    expect(await seo.readProductEditorial(productId)).toMatchObject({
      metaTitle: content.seo.metaTitle,
    });
  });
  it("allows exactly one of two competing saves", async () => {
    const results = await Promise.allSettled([
      service.save(productId, actorId, { revision: 2, action: "save-draft", content }),
      service.save(productId, actorId, {
        revision: 2,
        action: "save-draft",
        content: { ...content, name: "Competing edit" },
      }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(
      (await client.productEditorialDraft.findUniqueOrThrow({ where: { productId } })).revision,
    ).toBe(3);
    expect(await client.adminAuditEvent.count({ where: { subjectId: productId } })).toBe(3);
  });
});
