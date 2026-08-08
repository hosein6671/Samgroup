import { PrismaService } from "../../prisma/prisma.service";

import { RedirectsService } from "./redirects.service";

const GLOBAL_RULE = {
  fromPath: "/base-oils",
  toPath: "/products/base-oils",
  statusCode: 301,
  locale: null,
};

const LOCALE_RULE = {
  fromPath: "/fa/base-oils",
  toPath: "/fa/products/روغن-پایه",
  statusCode: 301,
  locale: "fa",
};

type Stubs = {
  service: RedirectsService;
  findMany: jest.Mock;
};

function createService(): Stubs {
  const findMany = jest.fn().mockResolvedValue([GLOBAL_RULE, LOCALE_RULE]);
  const prisma = { redirect: { findMany } } as unknown as PrismaService;

  return { service: new RedirectsService(prisma), findMany };
}

describe("RedirectsService.findActive", () => {
  it("returns only active rules, in a deterministic order", async () => {
    const { service, findMany } = createService();

    await expect(service.findActive()).resolves.toEqual([GLOBAL_RULE, LOCALE_RULE]);

    expect(findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: [{ fromPath: "asc" }, { locale: "asc" }],
      select: { fromPath: true, toPath: true, statusCode: true, locale: true },
    });
  });

  // Middleware matches on paths; id and createdAt are internal, exactly as they are on the
  // Locale response.
  it("exposes neither the surrogate key nor the audit timestamp", async () => {
    const { service, findMany } = createService();

    await service.findActive();

    const call = findMany.mock.calls[0]?.[0] as { select: Record<string, unknown> };

    expect(call.select).not.toHaveProperty("id");
    expect(call.select).not.toHaveProperty("createdAt");
  });

  // A middleware that only received one locale's rules would produce dead links for the
  // rules it never saw, so the read is deliberately not locale-scoped.
  it("does not filter by locale, so global rules travel with locale-specific ones", async () => {
    const { service, findMany } = createService();

    const rules = await service.findActive();

    const call = findMany.mock.calls[0]?.[0] as { where: Record<string, unknown> };

    expect(call.where).toEqual({ isActive: true });
    expect(rules.map((rule) => rule.locale)).toEqual([null, "fa"]);
  });

  it("returns an empty list rather than failing when no rule is configured", async () => {
    const { service, findMany } = createService();

    findMany.mockResolvedValue([]);

    await expect(service.findActive()).resolves.toEqual([]);
  });
});
