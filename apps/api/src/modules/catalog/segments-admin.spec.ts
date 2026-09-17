import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { SegmentCreate } from "./segments-admin.dto";
import { SegmentsAdminService } from "./segments-admin.service";
import type { PrismaService } from "../../prisma/prisma.service";
import type { AuditService } from "../audit/audit.service";

describe("SegmentCreate validation", () => {
  it("rejects a blank or whitespace-only name", async () => {
    for (const name of ["", "   "])
      expect((await validate(plainToInstance(SegmentCreate, { name }))).length).toBeGreaterThan(0);
  });
  it("rejects a name over 60 characters", async () => {
    expect(
      (await validate(plainToInstance(SegmentCreate, { name: "a".repeat(61) }))).length,
    ).toBeGreaterThan(0);
  });
  it("accepts an ordinary name", async () => {
    expect(await validate(plainToInstance(SegmentCreate, { name: "Off-Road" }))).toEqual([]);
  });
});

describe("SegmentsAdminService.list", () => {
  it("orders by sortOrder and reports each Segment's product count", async () => {
    const prisma = {
      segment: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: "1", name: "Marine", slug: "marine", sortOrder: 8, _count: { products: 12 } },
          ]),
      },
    };
    const service = new SegmentsAdminService(
      prisma as unknown as PrismaService,
      {} as AuditService,
    );
    expect(await service.list()).toEqual([
      { id: "1", name: "Marine", slug: "marine", sortOrder: 8, productCount: 12 },
    ]);
    expect(prisma.segment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { sortOrder: "asc" } }),
    );
  });
});

describe("SegmentsAdminService.create", () => {
  function service(overrides: { aggregate?: unknown; create?: (data: unknown) => unknown }): {
    service: SegmentsAdminService;
    audit: { append: jest.Mock };
    tx: Record<string, unknown>;
  } {
    const tx = {
      segment: {
        aggregate: jest.fn().mockResolvedValue(overrides.aggregate ?? { _max: { sortOrder: 8 } }),
        create: jest.fn(
          overrides.create ??
            ((args: { data: Record<string, unknown> }) => ({
              id: "new-id",
              name: args.data.name,
              slug: args.data.slug,
              sortOrder: args.data.sortOrder,
            })),
        ),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (work: (value: typeof tx) => Promise<unknown>) => work(tx)),
    };
    const audit = { append: jest.fn() };
    return {
      service: new SegmentsAdminService(
        prisma as unknown as PrismaService,
        audit as unknown as AuditService,
      ),
      audit,
      tx,
    };
  }

  it("derives a slug, appends past the current max sortOrder, and records activity", async () => {
    const { service: svc, audit, tx } = service({});
    expect(await svc.create("actor-1", { name: "Off-Road" })).toEqual({
      id: "new-id",
      name: "Off-Road",
      slug: "off-road",
      sortOrder: 9,
      productCount: 0,
    });
    expect((tx.segment as { create: jest.Mock }).create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { name: "Off-Road", slug: "off-road", sortOrder: 9 } }),
    );
    expect(audit.append).toHaveBeenCalledWith(
      { event: "segment.created", actorId: "actor-1", subjectId: "new-id", outcome: "success" },
      tx,
    );
  });

  it("starts sortOrder at 1 for the very first Segment", async () => {
    const { service: svc } = service({ aggregate: { _max: { sortOrder: null } } });
    expect((await svc.create("actor-1", { name: "First" })).sortOrder).toBe(1);
  });

  it('refuses a name that folds to "other" — ADR-008 §2 stays closed', async () => {
    const { service: svc } = service({});
    await expect(svc.create("actor-1", { name: "Other" })).rejects.toMatchObject({ status: 409 });
    await expect(svc.create("actor-1", { name: "OTHER" })).rejects.toMatchObject({ status: 409 });
  });

  it("refuses a name that folds to an empty slug", async () => {
    const { service: svc } = service({});
    await expect(svc.create("actor-1", { name: "___" })).rejects.toMatchObject({ status: 409 });
  });

  it("reports a clean conflict for a duplicate slug rather than a raw Prisma error", async () => {
    const { service: svc } = service({
      create: () => {
        throw { code: "P2002" };
      },
    });
    await expect(svc.create("actor-1", { name: "Marine" })).rejects.toMatchObject({ status: 409 });
  });
});
