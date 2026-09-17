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
  it("validates bounded section rows and rejects unknown row fields", async () => {
    for (const sections of [
      { applications: null },
      {
        features: Array.from({ length: 21 }, () => ({
          title: "Feature",
          description: "Description",
        })),
      },
      { applications: [[{ title: "Nested", description: "Invalid" }]] },
      { faq: [{ question: "   ", answer: "Answer" }] },
      { faq: [{ question: "Question", answer: "Answer", approved: true }] },
    ])
      expect(
        (
          await validate(
            plainToInstance(ProductEditorialEdit, {
              revision: 0,
              action: "save-draft",
              content: { ...content, ...sections },
            }),
            { whitelist: true, forbidNonWhitelisted: true },
          )
        ).length,
      ).toBeGreaterThan(0);
  });
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

describe("product Segment assignment", () => {
  it("lists the assigned Segment ids alongside every available Segment", async () => {
    const prisma = {
      product: { findUnique: jest.fn().mockResolvedValue({ id: "p1" }) },
      productSegment: {
        findMany: jest.fn().mockResolvedValue([{ segmentId: "s1" }, { segmentId: "s2" }]),
      },
      segment: {
        findMany: jest.fn().mockResolvedValue([{ id: "s1", name: "Industry", slug: "industry" }]),
      },
    };
    const service = new ProductEditorService(
      prisma as unknown as PrismaService,
      {} as SeoService,
      {} as AuditService,
    );
    expect(await service.segments("p1")).toEqual({
      assigned: ["s1", "s2"],
      available: [{ id: "s1", name: "Industry", slug: "industry" }],
    });
  });
  it("404s for a product that does not exist", async () => {
    const prisma = { product: { findUnique: jest.fn().mockResolvedValue(null) } };
    const service = new ProductEditorService(
      prisma as unknown as PrismaService,
      {} as SeoService,
      {} as AuditService,
    );
    await expect(service.segments("missing")).rejects.toMatchObject({ status: 404 });
  });
  it("replaces the membership set, records activity, and de-duplicates the input", async () => {
    const tx = {
      productSegment: { deleteMany: jest.fn(), createMany: jest.fn() },
    };
    const audit = { append: jest.fn() };
    const prisma = {
      product: { findUnique: jest.fn().mockResolvedValue({ id: "p1" }) },
      segment: { count: jest.fn().mockResolvedValue(2) },
      $transaction: jest.fn(async (work: (value: typeof tx) => Promise<unknown>) => work(tx)),
    };
    const service = new ProductEditorService(
      prisma as unknown as PrismaService,
      {} as SeoService,
      audit as unknown as AuditService,
    );
    expect(await service.setSegments("p1", ["s1", "s2", "s1"], "actor-1")).toEqual({
      assigned: ["s1", "s2"],
    });
    expect(tx.productSegment.deleteMany).toHaveBeenCalledWith({ where: { productId: "p1" } });
    expect(tx.productSegment.createMany).toHaveBeenCalledWith({
      data: [
        { productId: "p1", segmentId: "s1" },
        { productId: "p1", segmentId: "s2" },
      ],
    });
    expect(audit.append).toHaveBeenCalledWith(
      {
        event: "product.segments_changed",
        actorId: "actor-1",
        subjectId: "p1",
        outcome: "success",
      },
      tx,
    );
  });
  it("clears every membership when given an empty set, without creating rows", async () => {
    const tx = { productSegment: { deleteMany: jest.fn(), createMany: jest.fn() } };
    const prisma = {
      product: { findUnique: jest.fn().mockResolvedValue({ id: "p1" }) },
      $transaction: jest.fn(async (work: (value: typeof tx) => Promise<unknown>) => work(tx)),
    };
    const service = new ProductEditorService(
      prisma as unknown as PrismaService,
      {} as SeoService,
      { append: jest.fn() } as unknown as AuditService,
    );
    expect(await service.setSegments("p1", [], "actor-1")).toEqual({ assigned: [] });
    expect(tx.productSegment.deleteMany).toHaveBeenCalled();
    expect(tx.productSegment.createMany).not.toHaveBeenCalled();
  });
  it("refuses an id that names no real Segment, writing nothing", async () => {
    const prisma = {
      product: { findUnique: jest.fn().mockResolvedValue({ id: "p1" }) },
      segment: { count: jest.fn().mockResolvedValue(1) },
      $transaction: jest.fn(),
    };
    const service = new ProductEditorService(
      prisma as unknown as PrismaService,
      {} as SeoService,
      {} as AuditService,
    );
    await expect(
      service.setSegments("p1", ["s1", "does-not-exist"], "actor-1"),
    ).rejects.toMatchObject({ status: 400 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
