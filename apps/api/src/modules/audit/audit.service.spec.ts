import { AuditService } from "./audit.service";
import type { AuditEntry } from "./audit.service";
import type { PrismaService } from "../../prisma/prisma.service";
describe("audit persistence", () => {
  it("projects only allowed metadata even when a caller supplies extra secrets", async () => {
    const create = jest.fn().mockResolvedValue({});
    const service = new AuditService({ adminAuditEvent: { create } } as unknown as PrismaService);
    await service.append({
      event: "auth.login",
      outcome: "failure",
      password: "never-store",
      accessToken: "never-store",
      body: { secret: true },
    } as unknown as AuditEntry);
    expect(create).toHaveBeenCalledWith({
      data: {
        event: "auth.login",
        outcome: "failure",
        actorId: undefined,
        subjectId: undefined,
        httpStatus: undefined,
      },
    });
  });
  it("propagates persistence failure so transactional callers can roll back", async () => {
    const create = jest.fn().mockRejectedValue(new Error("storage unavailable"));
    const service = new AuditService({ adminAuditEvent: { create } } as unknown as PrismaService);
    await expect(service.append({ event: "user.created", outcome: "success" })).rejects.toThrow(
      "storage unavailable",
    );
  });
});
