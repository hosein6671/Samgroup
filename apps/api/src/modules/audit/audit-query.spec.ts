import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { AuditController, AuditQuery } from "./audit-admin.module";
import type { AuditService } from "./audit.service";

describe("audit query validation", () => {
  it.each([
    { page: 0 },
    { actorId: "not-a-user" },
    { outcome: "anything" },
    { event: "unknown" },
    { from: "2026-02-31" },
  ])("rejects invalid filters %j", async (input) => {
    expect((await validate(plainToInstance(AuditQuery, input))).length).toBeGreaterThan(0);
  });
  it("rejects a reversed time range before querying storage", async () => {
    const list = jest.fn();
    const controller = new AuditController({ list } as unknown as AuditService);
    await expect(
      controller.list(
        plainToInstance(AuditQuery, { from: "2026-09-10T00:00:00Z", to: "2026-09-09T00:00:00Z" }),
      ),
    ).rejects.toThrow("Start time");
    expect(list).not.toHaveBeenCalled();
  });
});
