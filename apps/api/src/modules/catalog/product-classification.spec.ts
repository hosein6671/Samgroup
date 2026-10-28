import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { ProductClassificationEdit } from "./product-classification.dto";
import { ProductClassificationService } from "./product-classification.service";

import type { PrismaService } from "../../prisma/prisma.service";
import type { AuditService } from "../audit/audit.service";

const P = "11111111-1111-4111-8111-111111111111";
const F1 = "22222222-2222-4222-8222-222222222222";
const F2 = "33333333-3333-4333-8333-333333333333";
const T1 = "44444444-4444-4444-8444-444444444444";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- a test harness whose inferred shape is the point
function harness(
  product: {
    categoryId: string;
    productTypeId: string | null;
    applicationGroupId: string | null;
  } | null,
) {
  const tx = { product: { update: jest.fn() } };
  const prisma = {
    product: { findUnique: jest.fn().mockResolvedValue(product) },
    category: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
        where.id === "missing" ? null : { id: where.id },
      ),
    },
    productType: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
        where.id === "missing" ? null : { id: where.id },
      ),
    },
    $transaction: jest.fn(async (work: (value: typeof tx) => Promise<unknown>) => work(tx)),
  };
  const audit = { append: jest.fn() };
  const service = new ProductClassificationService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
  );
  return { tx, prisma, audit, service };
}

describe("ProductClassificationService (ADR-030)", () => {
  it("moves a product to another family and clears its group in the same write", async () => {
    const { tx, audit, service } = harness({
      categoryId: F1,
      productTypeId: T1,
      applicationGroupId: "g",
    });
    expect(await service.set("a", P, { categoryId: F2, productTypeId: T1 })).toEqual({
      categoryId: F2,
      productTypeId: T1,
      groupCleared: true,
    });
    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id: P },
      data: { categoryId: F2, productTypeId: T1, applicationGroupId: null },
    });
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({ event: "product.taxonomy_changed", subjectId: P }),
      tx,
    );
  });

  it("keeps the group when only the type changes, and writes nothing when nothing changes", async () => {
    const changed = harness({ categoryId: F1, productTypeId: null, applicationGroupId: "g" });
    await changed.service.set("a", P, { categoryId: F1, productTypeId: T1 });
    expect(changed.tx.product.update).toHaveBeenCalledWith({
      where: { id: P },
      data: { categoryId: F1, productTypeId: T1 },
    });
    const same = harness({ categoryId: F1, productTypeId: T1, applicationGroupId: null });
    await same.service.set("a", P, { categoryId: F1, productTypeId: T1 });
    expect(same.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("refuses an unknown product, family or type", async () => {
    await expect(
      harness(null).service.set("a", P, { categoryId: F1, productTypeId: null }),
    ).rejects.toMatchObject({ status: 404 });
    const row = { categoryId: F1, productTypeId: null, applicationGroupId: null };
    await expect(
      harness(row).service.set("a", P, { categoryId: "missing", productTypeId: null }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      harness(row).service.set("a", P, { categoryId: F1, productTypeId: "missing" }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("validates the body: a family is required, a type may be null", async () => {
    const check = async (body: unknown): Promise<number> =>
      (
        await validate(plainToInstance(ProductClassificationEdit, body), {
          whitelist: true,
          forbidNonWhitelisted: true,
        })
      ).length;
    expect(await check({ categoryId: F1, productTypeId: null })).toBe(0);
    expect(await check({ categoryId: F1, productTypeId: T1 })).toBe(0);
    expect(await check({ productTypeId: T1 })).toBeGreaterThan(0);
    expect(await check({ categoryId: "x", productTypeId: null })).toBeGreaterThan(0);
    expect(await check({ categoryId: F1, productTypeId: T1, slug: "x" })).toBeGreaterThan(0);
  });
});
