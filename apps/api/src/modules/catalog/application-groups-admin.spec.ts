import { ApplicationGroupsAdminService } from "./application-groups-admin.service";

import type { ContentTranslationService } from "../../common/content/content-translation.service";
import type { PrismaService } from "../../prisma/prisma.service";
import type { AuditService } from "../audit/audit.service";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- a harness whose inferred shape is the point
function harness() {
  const tx = {
    applicationGroup: {
      aggregate: jest.fn().mockResolvedValue({ _max: { sortOrder: 3 } }),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: "g1",
        ...data,
      })),
      update: jest.fn(),
      delete: jest.fn(),
    },
    product: { update: jest.fn() },
    contentTranslation: { deleteMany: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn(async (work: (value: typeof tx) => Promise<unknown>) => work(tx)),
    category: { findUnique: jest.fn().mockResolvedValue({ id: "c1" }) },
    applicationGroup: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    product: { findUnique: jest.fn() },
    contentTranslation: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const audit = { append: jest.fn() };
  const translations = { publishField: jest.fn() };
  const service = new ApplicationGroupsAdminService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
    translations as unknown as ContentTranslationService,
  );
  return { tx, prisma, audit, translations, service };
}

describe("ApplicationGroupsAdminService (ADR-029)", () => {
  it("creates a group at the end of its family with a derived slug, audited", async () => {
    const { tx, audit, service } = harness();
    const created = await service.create("admin", { categoryId: "c1", name: "Gears & synthetics" });
    expect(tx.applicationGroup.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          categoryId: "c1",
          name: "Gears & synthetics",
          slug: "gears-synthetics",
          sortOrder: 4,
        },
      }),
    );
    expect(created.productCount).toBe(0);
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({ event: "application_group.created", subjectId: "g1" }),
      tx,
    );
  });

  it("refuses a name with no usable slug and an unknown family", async () => {
    const { prisma, service } = harness();
    await expect(service.create("a", { categoryId: "c1", name: "توربین" })).rejects.toMatchObject({
      status: 400,
    });
    prisma.category.findUnique.mockResolvedValueOnce(null);
    await expect(service.create("a", { categoryId: "c9", name: "Turbines" })).rejects.toMatchObject(
      {
        status: 404,
      },
    );
  });

  it("writes a non-default locale's name as a translation, never over the column", async () => {
    const { tx, prisma, translations, service } = harness();
    prisma.applicationGroup.findUnique.mockResolvedValue({ id: "g1" });
    await service.update("a", "g1", { name: "توربین‌ها" }, { code: "fa", isDefault: false });
    expect(translations.publishField).toHaveBeenCalledWith(
      "ApplicationGroup",
      "g1",
      "fa",
      "name",
      "توربین‌ها",
      "HUMAN_REVIEWED",
      tx,
    );
    expect(tx.applicationGroup.update).not.toHaveBeenCalled();
    await service.update(
      "a",
      "g1",
      { name: "Turbines", sortOrder: 2 },
      { code: "en", isDefault: true },
    );
    expect(tx.applicationGroup.update).toHaveBeenCalledWith({
      where: { id: "g1" },
      data: { name: "Turbines", sortOrder: 2 },
    });
  });

  it("refuses to delete a group that still has products", async () => {
    const { tx, prisma, service } = harness();
    prisma.applicationGroup.findUnique.mockResolvedValue({ _count: { products: 2 } });
    await expect(service.remove("a", "g1")).rejects.toMatchObject({ status: 409 });
    expect(tx.applicationGroup.delete).not.toHaveBeenCalled();
  });

  it("assigns only a group of the product's own family", async () => {
    const { tx, prisma, audit, service } = harness();
    prisma.product.findUnique.mockResolvedValue({ categoryId: "c1" });
    prisma.applicationGroup.findUnique.mockResolvedValueOnce({ categoryId: "c2" });
    await expect(service.assign("a", "p1", "g2")).rejects.toMatchObject({ status: 400 });
    expect(tx.product.update).not.toHaveBeenCalled();
    prisma.applicationGroup.findUnique.mockResolvedValueOnce({ categoryId: "c1" });
    await service.assign("a", "p1", "g1");
    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { applicationGroupId: "g1" },
    });
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({ event: "product.application_group_changed", subjectId: "p1" }),
      tx,
    );
    await service.assign("a", "p1", null);
    expect(tx.product.update).toHaveBeenLastCalledWith({
      where: { id: "p1" },
      data: { applicationGroupId: null },
    });
  });
});
