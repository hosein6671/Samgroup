import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, UserRole } from "../../prisma/generated/client";
import type { PrismaService } from "../../prisma/prisma.service";
import { PasswordService } from "./password.service";
import { UserManagementService } from "./user-management.service";
import { AuditService } from "../audit/audit.service";

const url = process.env["USER_MANAGEMENT_TEST_DATABASE_URL"];
if (url && !/^\/sam_platform_disposable_[a-z0-9_]+$/.test(new URL(url).pathname)) {
  throw new Error("User management tests require an explicitly disposable database.");
}
const databaseSuite = url ? describe : describe.skip;
databaseSuite("user management with PostgreSQL", () => {
  let client: PrismaClient;
  let service: UserManagementService;
  const passwords = new PasswordService();
  beforeAll(() => {
    client = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
    const prisma = client as unknown as PrismaService;
    service = new UserManagementService(prisma, passwords, new AuditService(prisma));
  });
  afterAll(async () => {
    await client.$disconnect();
  });
  async function admin(): Promise<Awaited<ReturnType<PrismaClient["user"]["create"]>>> {
    return client.user.create({
      data: {
        email: `${randomUUID()}@example.test`,
        passwordHash: await passwords.hash(randomUUID()),
        role: UserRole.ADMIN,
      },
    });
  }
  it("creates, updates and disables a disposable account with persisted audit and revocation", async () => {
    const actor = await admin();
    const secret = randomUUID();
    const user = await service.create(actor.id, {
      email: `${randomUUID()}@example.test`,
      password: secret,
      role: UserRole.CONTENT_MANAGER,
    });
    const stored = await client.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(await passwords.verify(stored.passwordHash, secret)).toBe(true);
    expect(user).not.toHaveProperty("passwordHash");
    await service.update(actor.id, user.id, {
      role: UserRole.SALES_EXPERT,
      status: "DISABLED",
      revision: 0,
    });
    const disabled = await client.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(disabled.credentialsRevokedAt).not.toBeNull();
    expect(disabled.adminRevision).toBe(1);
    await expect(
      service.update(actor.id, user.id, { role: UserRole.CUSTOMER, status: "ACTIVE", revision: 0 }),
    ).rejects.toThrow("Reload");
    const events = await client.adminAuditEvent.findMany({ where: { subjectId: user.id } });
    expect(events.map((event) => event.event).sort()).toEqual([
      "user.created",
      "user.role_changed",
      "user.status_changed",
    ]);
    expect(events.every((event) => event.actorId === actor.id)).toBe(true);
    await client.user.delete({ where: { id: actor.id } });
  }, 30000);
  it("rolls back the account change when audit persistence fails", async () => {
    const actor = await admin();
    const target = await service.create(actor.id, {
      email: `${randomUUID()}@example.test`,
      password: randomUUID(),
      role: UserRole.CUSTOMER,
    });
    const broken = new UserManagementService(client as unknown as PrismaService, passwords, {
      append: async () => {
        throw new Error("audit unavailable");
      },
    } as unknown as AuditService);
    await expect(
      broken.update(actor.id, target.id, {
        role: UserRole.CONTENT_MANAGER,
        status: "ACTIVE",
        revision: 0,
      }),
    ).rejects.toThrow("audit unavailable");
    const stored = await client.user.findUniqueOrThrow({ where: { id: target.id } });
    expect(stored.role).toBe(UserRole.CUSTOMER);
    expect(stored.adminRevision).toBe(0);
    await client.user.delete({ where: { id: actor.id } });
  }, 30000);
  it("keeps an active Admin when the only two Admins demote each other concurrently", async () => {
    expect(await client.user.count({ where: { role: UserRole.ADMIN, status: "ACTIVE" } })).toBe(0);
    const first = await admin();
    const second = await admin();
    const input = { role: UserRole.CUSTOMER, status: "ACTIVE" as const, revision: 0 };
    const results = await Promise.allSettled([
      service.update(first.id, second.id, input),
      service.update(second.id, first.id, input),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await client.user.count({ where: { role: UserRole.ADMIN, status: "ACTIVE" } })).toBe(1);
    const remaining = await client.user.findFirstOrThrow({
      where: { role: UserRole.ADMIN, status: "ACTIVE" },
    });
    await expect(service.update(remaining.id, remaining.id, input)).rejects.toThrow(
      "another administrator",
    );
  }, 30000);
});
