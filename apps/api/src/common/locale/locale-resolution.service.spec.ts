import { HttpStatus } from "@nestjs/common";

import { ApiException } from "../http/api.exception";
import { ErrorCode } from "../http/error-code";

import { LocaleResolutionService } from "./locale-resolution.service";

import type { LocalesService } from "../../modules/localization/locales.service";
import type { LocaleResponse } from "../../modules/localization/dto/locale.response";

const ACTIVE: LocaleResponse[] = [
  { code: "en", name: "English", nativeName: "English", direction: "ltr", isDefault: true },
  { code: "fa", name: "Persian", nativeName: "فارسی", direction: "rtl", isDefault: false },
];

/**
 * LocalesService is stubbed rather than instantiated: this service's contract is what it does
 * with an active locale list, not how that list is read.
 */
function createService(active: LocaleResponse[] = ACTIVE): LocaleResolutionService {
  const localesService = {
    findActive: jest.fn().mockResolvedValue(active),
  } as unknown as LocalesService;

  return new LocaleResolutionService(localesService);
}

/**
 * Captures the thrown ApiException. A bare `.catch()` types the result as the union of the
 * rejection and the resolved value, and a rejection that never happens has to fail the test
 * rather than pass silently.
 */
async function captureError(promise: Promise<unknown>): Promise<ApiException> {
  try {
    await promise;
  } catch (thrown) {
    return thrown as ApiException;
  }

  throw new Error("Expected the call to reject, but it resolved.");
}

describe("LocaleResolutionService", () => {
  it("falls back to the platform default when no locale is requested", async () => {
    await expect(createService().resolve()).resolves.toEqual({
      code: "en",
      defaultCode: "en",
      isDefault: true,
    });
  });

  it("resolves an active non-default locale and reports it as non-default", async () => {
    await expect(createService().resolve("fa")).resolves.toEqual({
      code: "fa",
      defaultCode: "en",
      isDefault: false,
    });
  });

  // The rule API_CONTRACT_FINAL.md §3 exists for: a typo'd locale silently serving English is
  // the bug that survives to production.
  it("rejects an unknown locale with INVALID_LOCALE rather than defaulting", async () => {
    const error = await captureError(createService().resolve("de"));

    expect(error).toBeInstanceOf(ApiException);
    expect(error.code).toBe(ErrorCode.InvalidLocale);
    expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(error.details).toEqual([{ field: "locale", issue: expect.any(String) }]);
  });

  // findActive() returns active rows only, so an inactive locale is indistinguishable from a
  // nonexistent one here — both are locales the platform does not serve.
  it("rejects an inactive locale the same way as an unknown one", async () => {
    const error = await captureError(createService([ACTIVE[0] as LocaleResponse]).resolve("fa"));

    expect(error.code).toBe(ErrorCode.InvalidLocale);
  });

  it("never echoes the rejected value back in the message", async () => {
    const error = await captureError(createService().resolve("<script>alert(1)</script>"));

    expect(error.message).not.toContain("script");
  });

  it("treats an empty locale value as invalid, not as omitted", async () => {
    const error = await captureError(createService().resolve(""));

    expect(error.code).toBe(ErrorCode.InvalidLocale);
  });

  // A platform with no default is misconfigured, not a bad request — the caller did nothing
  // wrong and must not be told they did.
  it("raises INTERNAL_ERROR when no active locale is the default", async () => {
    const error = await captureError(createService([ACTIVE[1] as LocaleResponse]).resolve());

    expect(error.code).toBe(ErrorCode.InternalError);
    expect(error.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
  });

  it("re-reads the active locales on every call, so deactivation takes effect immediately", async () => {
    const localesService = {
      findActive: jest.fn().mockResolvedValue(ACTIVE),
    } as unknown as LocalesService;
    const service = new LocaleResolutionService(localesService);

    await service.resolve("fa");
    await service.resolve("fa");

    expect(localesService.findActive).toHaveBeenCalledTimes(2);
  });
});
