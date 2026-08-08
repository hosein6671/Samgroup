import { LocaleDirection } from "../../prisma/generated/client";
import { PrismaService } from "../../prisma/prisma.service";

import { LocalesService } from "./locales.service";

/**
 * No database is reached: PrismaService is replaced by a stub exposing only the delegate
 * method this service uses, so nothing here opens a socket.
 */
type StubbedPrisma = {
  service: LocalesService;
  findMany: jest.Mock;
};

const ROWS = [
  {
    code: "en",
    name: "English",
    nativeName: "English",
    direction: LocaleDirection.LTR,
    isDefault: true,
  },
  {
    code: "fa",
    name: "Persian",
    nativeName: "فارسی",
    direction: LocaleDirection.RTL,
    isDefault: false,
  },
];

function createService(rows: unknown[] = ROWS): StubbedPrisma {
  const findMany = jest.fn().mockResolvedValue(rows);
  const prisma = { locale: { findMany } } as unknown as PrismaService;

  return { service: new LocalesService(prisma), findMany };
}

describe("LocalesService", () => {
  // Asserted as one exact object rather than field by field: the active-only filter, the
  // display ordering and the field selection are the contract (API_CONTRACT_FINAL.md §2.1),
  // so a change to any of them should fail a test rather than pass unnoticed.
  it("reads active locales only, in display order, selecting the contract fields", async () => {
    const { service, findMany } = createService();

    await service.findActive();

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: {
        code: true,
        name: true,
        nativeName: true,
        direction: true,
        isDefault: true,
      },
    });
  });

  it("emits direction lowercase, not the Prisma enum member name", async () => {
    const { service } = createService();

    const locales = await service.findActive();

    expect(locales.map((locale) => locale.direction)).toEqual(["ltr", "rtl"]);
  });

  it("returns the five contract fields and nothing else", async () => {
    const { service } = createService();

    const [locale] = await service.findActive();

    expect(locale).toEqual({
      code: "en",
      name: "English",
      nativeName: "English",
      direction: "ltr",
      isDefault: true,
    });
  });

  it("preserves the order the query returned", async () => {
    const { service } = createService();

    const locales = await service.findActive();

    expect(locales.map((locale) => locale.code)).toEqual(["en", "fa"]);
  });

  // A platform with no active locale is a bootstrap failure, but an empty collection is
  // still an empty collection — this endpoint must not invent a 404.
  it("returns an empty list when no locale is active", async () => {
    const { service } = createService([]);

    await expect(service.findActive()).resolves.toEqual([]);
  });
});
