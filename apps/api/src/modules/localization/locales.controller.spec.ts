import { Test } from "@nestjs/testing";

import { LocalesController } from "./locales.controller";
import { LocalesService } from "./locales.service";

import type { LocaleResponse } from "./dto/locale.response";

const LOCALES: LocaleResponse[] = [
  { code: "en", name: "English", nativeName: "English", direction: "ltr", isDefault: true },
];

async function createController(service: Partial<LocalesService>): Promise<LocalesController> {
  const moduleRef = await Test.createTestingModule({
    controllers: [LocalesController],
    providers: [{ provide: LocalesService, useValue: service }],
  }).compile();

  return moduleRef.get(LocalesController);
}

describe("LocalesController", () => {
  // toBe, not toEqual: the controller must hand the service's result through untouched. The
  // {data, meta} envelope is the global interceptor's job, and a controller that wrapped or
  // reshaped anything here would double-wrap the response.
  it("returns the service's locales unchanged", async () => {
    const findActive = jest.fn().mockResolvedValue(LOCALES);

    const controller = await createController({ findActive });

    await expect(controller.findAll()).resolves.toBe(LOCALES);
    expect(findActive).toHaveBeenCalledTimes(1);
  });

  it("passes no arguments — the endpoint takes no query parameters", async () => {
    const findActive = jest.fn().mockResolvedValue([]);

    const controller = await createController({ findActive });
    await controller.findAll();

    expect(findActive).toHaveBeenCalledWith();
  });
});
