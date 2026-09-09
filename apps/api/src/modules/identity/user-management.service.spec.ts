import { UserManagementService } from "./user-management.service";
import { UserRole } from "../../prisma/generated/client";
import type { PrismaService } from "../../prisma/prisma.service";
import type { PasswordService } from "./password.service";
import type { AuditService } from "../audit/audit.service";
describe("user management boundaries", () => {
  it("rejects self account changes before any database write", async () => {
    const prisma = { $transaction: jest.fn() };
    const service = new UserManagementService(
      prisma as unknown as PrismaService,
      {} as PasswordService,
      {} as AuditService,
    );
    await expect(
      service.update("same", "same", { role: UserRole.ADMIN, status: "ACTIVE", revision: 0 }),
    ).rejects.toThrow("another administrator");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it("creates only a hashed credential and writes audit within the transaction", async () => {
    const user = {
      id: "new",
      email: "staff@example.test",
      role: UserRole.CONTENT_MANAGER,
      status: "ACTIVE",
      adminRevision: 0,
    };
    const tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ role: UserRole.ADMIN, status: "ACTIVE" }),
        create: jest.fn().mockResolvedValue(user),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (value: unknown) => unknown) => callback(tx)),
    };
    const hash = jest.fn().mockResolvedValue("hash");
    const append = jest.fn().mockResolvedValue(undefined);
    const service = new UserManagementService(
      prisma as unknown as PrismaService,
      { hash } as unknown as PasswordService,
      { append } as unknown as AuditService,
    );
    await service.create("actor", {
      email: user.email,
      password: "input-secret",
      role: UserRole.CONTENT_MANAGER,
    });
    expect(tx.user.create.mock.calls[0]?.[0].data).toEqual({
      email: user.email,
      passwordHash: "hash",
      role: UserRole.CONTENT_MANAGER,
    });
    expect(append).toHaveBeenCalledWith(
      { event: "user.created", outcome: "success", actorId: "actor", subjectId: "new" },
      tx,
    );
  });
});

describe("account update safeguards", () => {
  function setup(): {
    service: UserManagementService;
    tx: { user: { findUnique: jest.Mock; count: jest.Mock; update: jest.Mock } };
    prisma: { $transaction: jest.Mock };
    append: jest.Mock;
  } {
    const previous = {
      id: "target",
      email: "test@example.test",
      role: UserRole.ADMIN,
      status: "ACTIVE",
      adminRevision: 3,
    };
    const tx = {
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({ role: UserRole.ADMIN, status: "ACTIVE" })
          .mockResolvedValueOnce(previous),
        count: jest.fn().mockResolvedValue(2),
        update: jest.fn().mockResolvedValue({
          ...previous,
          role: UserRole.CONTENT_MANAGER,
          status: "DISABLED",
          adminRevision: 4,
        }),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (value: unknown) => unknown) => callback(tx)),
    };
    const append = jest.fn().mockResolvedValue(undefined);
    const service = new UserManagementService(
      prisma as unknown as PrismaService,
      {} as PasswordService,
      { append } as unknown as AuditService,
    );
    return { service, tx, prisma, append };
  }
  const input = { role: UserRole.CONTENT_MANAGER, status: "DISABLED" as const, revision: 3 };
  it("rejects a stale revision without a write or success event", async () => {
    const { service, tx, append } = setup();
    await expect(service.update("actor", "target", { ...input, revision: 2 })).rejects.toThrow(
      "Reload",
    );
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(append).not.toHaveBeenCalled();
  });
  it("refuses removal of the last active administrator", async () => {
    const { service, tx } = setup();
    tx.user.count.mockResolvedValue(1);
    await expect(service.update("actor", "target", input)).rejects.toThrow("At least one");
    expect(tx.user.update).not.toHaveBeenCalled();
  });
  it("rechecks the actor inside the transaction", async () => {
    const { service, tx } = setup();
    tx.user.findUnique.mockReset().mockResolvedValue({ role: UserRole.ADMIN, status: "DISABLED" });
    await expect(service.update("actor", "target", input)).rejects.toThrow("Forbidden");
    expect(tx.user.update).not.toHaveBeenCalled();
  });
  it("uses serializable isolation and audits both changes in the same transaction", async () => {
    const { service, tx, prisma, append } = setup();
    await service.update("actor", "target", input);
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
    });
    expect(tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "target", adminRevision: 3 } }),
    );
    expect(append.mock.calls.map((call) => call[0].event)).toEqual([
      "user.role_changed",
      "user.status_changed",
    ]);
    expect(append.mock.calls.every((call) => call[1] === tx)).toBe(true);
  });
  it("propagates audit failure so the transaction cannot commit", async () => {
    const { service, append } = setup();
    append.mockRejectedValue(new Error("audit unavailable"));
    await expect(service.update("actor", "target", input)).rejects.toThrow("audit unavailable");
  });
  it("returns a reload conflict for a database serialization failure", async () => {
    const { service, tx } = setup();
    tx.user.update.mockRejectedValue({ code: "P2034" });
    await expect(service.update("actor", "target", input)).rejects.toThrow("Reload");
  });
});
