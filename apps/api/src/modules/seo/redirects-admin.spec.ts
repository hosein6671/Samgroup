import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { RedirectCreate, RedirectUpdate } from "./redirects-admin.dto";
import { RedirectsAdminService } from "./redirects-admin.service";
import type { PrismaService } from "../../prisma/prisma.service";
import type { AuditService } from "../audit/audit.service";

describe("RedirectCreate validation", () => {
  it("requires both paths to start with a slash", async () => {
    for (const input of [
      { fromPath: "old-page", toPath: "/new-page" },
      { fromPath: "/old-page", toPath: "new-page" },
    ])
      expect((await validate(plainToInstance(RedirectCreate, input))).length).toBeGreaterThan(0);
  });
  it("rejects a status code other than 301 or 302", async () => {
    expect(
      (
        await validate(
          plainToInstance(RedirectCreate, { fromPath: "/a", toPath: "/b", statusCode: 307 }),
        )
      ).length,
    ).toBeGreaterThan(0);
  });
  it("accepts a bare path pair with no optional fields", async () => {
    expect(
      await validate(plainToInstance(RedirectCreate, { fromPath: "/old", toPath: "/new" })),
    ).toEqual([]);
  });
});

describe("RedirectUpdate validation", () => {
  it("accepts a partial update", async () => {
    expect(await validate(plainToInstance(RedirectUpdate, { isActive: false }))).toEqual([]);
  });
});

function service(overrides: {
  create?: (data: unknown) => unknown;
  findUnique?: { id: string; fromPath: string } | null;
  update?: (data: unknown) => unknown;
  deleteRejects?: boolean;
}): { service: RedirectsAdminService; audit: { append: jest.Mock }; tx: Record<string, unknown> } {
  const tx = {
    redirect: {
      create: jest.fn(
        overrides.create ??
          ((args: { data: Record<string, unknown> }) => ({ id: "r1", ...args.data })),
      ),
      update: jest.fn(
        overrides.update ??
          ((args: { data: Record<string, unknown> }) => ({ id: "r1", ...args.data })),
      ),
      delete: jest.fn(() =>
        overrides.deleteRejects
          ? Promise.reject(new Error("P2025: not found"))
          : Promise.resolve({ id: "r1" }),
      ),
    },
  };
  const prisma = {
    redirect: {
      findUnique: jest
        .fn()
        .mockResolvedValue(
          "findUnique" in overrides ? overrides.findUnique : { id: "r1", fromPath: "/old" },
        ),
    },
    $transaction: jest.fn(async (work: (value: typeof tx) => Promise<unknown>) => work(tx)),
  };
  const audit = { append: jest.fn() };
  return {
    service: new RedirectsAdminService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
    ),
    audit,
    tx,
  };
}

describe("RedirectsAdminService.create", () => {
  it("creates with the default status code and global locale, then records activity", async () => {
    const { service: svc, audit, tx } = service({});
    const result = await svc.create("actor-1", { fromPath: "/old", toPath: "/new" });
    expect(result).toMatchObject({
      fromPath: "/old",
      toPath: "/new",
      statusCode: 301,
      locale: null,
    });
    expect((tx.redirect as { create: jest.Mock }).create).toHaveBeenCalled();
    expect(audit.append).toHaveBeenCalledWith(
      { event: "redirect.created", actorId: "actor-1", subjectId: "r1", outcome: "success" },
      tx,
    );
  });
  it("refuses a redirect that points a path at itself", async () => {
    const { service: svc } = service({});
    await expect(
      svc.create("actor-1", { fromPath: "/same", toPath: "/same" }),
    ).rejects.toMatchObject({ status: 400 });
  });
  it("reports a clean conflict for a duplicate (fromPath, locale) pair", async () => {
    const { service: svc } = service({
      create: () => {
        throw { code: "P2002" };
      },
    });
    await expect(svc.create("actor-1", { fromPath: "/old", toPath: "/new" })).rejects.toMatchObject(
      {
        status: 409,
      },
    );
  });
  it("reports a clean 400 for a locale that does not exist", async () => {
    const { service: svc } = service({
      create: () => {
        throw { code: "P2003" };
      },
    });
    await expect(
      svc.create("actor-1", { fromPath: "/old", toPath: "/new", locale: "zz" }),
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe("RedirectsAdminService.update", () => {
  it("404s for a redirect that does not exist", async () => {
    const { service: svc } = service({ findUnique: null });
    await expect(svc.update("missing", "actor-1", { isActive: false })).rejects.toMatchObject({
      status: 404,
    });
  });
  it("refuses retargeting a redirect at its own fromPath", async () => {
    const { service: svc } = service({ findUnique: { id: "r1", fromPath: "/old" } });
    await expect(svc.update("r1", "actor-1", { toPath: "/old" })).rejects.toMatchObject({
      status: 400,
    });
  });
  it("updates and records activity", async () => {
    const { service: svc, audit } = service({});
    await svc.update("r1", "actor-1", { isActive: false });
    expect(audit.append).toHaveBeenCalledWith(
      { event: "redirect.updated", actorId: "actor-1", subjectId: "r1", outcome: "success" },
      expect.anything(),
    );
  });
});

describe("RedirectsAdminService.remove", () => {
  it("404s for a redirect that does not exist", async () => {
    const { service: svc } = service({ deleteRejects: true });
    await expect(svc.remove("missing", "actor-1")).rejects.toMatchObject({ status: 404 });
  });
  it("deletes and records activity", async () => {
    const { service: svc, audit } = service({});
    await svc.remove("r1", "actor-1");
    expect(audit.append).toHaveBeenCalledWith(
      { event: "redirect.deleted", actorId: "actor-1", subjectId: "r1", outcome: "success" },
      expect.anything(),
    );
  });
});
