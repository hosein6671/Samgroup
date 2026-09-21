import { ConfigService } from "@nestjs/config";

import { PrismaService } from "./prisma.service";

const DATABASE_URL = "postgresql://sam_platform_user:pw@localhost:5432/sam_platform";

/**
 * No test here opens a socket: $connect and $disconnect are stubbed on the instance, and
 * the pg pool the adapter builds stays idle until something queries through it.
 */
describe("PrismaService", () => {
  function createService(config: ConfigService): PrismaService {
    return new PrismaService(config);
  }

  it("takes its connection string from configuration", () => {
    const configService = new ConfigService({ databaseUrl: DATABASE_URL, databasePoolMax: 10 });
    const getOrThrow = jest.spyOn(configService, "getOrThrow");

    createService(configService);

    expect(getOrThrow).toHaveBeenCalledWith("databaseUrl");
  });

  it("throws when the connection string is absent rather than connecting to a default", () => {
    expect(() => createService(new ConfigService({ databasePoolMax: 10 }))).toThrow();
  });

  it("takes its connection-pool size from configuration rather than an implicit default", () => {
    const configService = new ConfigService({ databaseUrl: DATABASE_URL, databasePoolMax: 25 });
    const getOrThrow = jest.spyOn(configService, "getOrThrow");

    createService(configService);

    expect(getOrThrow).toHaveBeenCalledWith("databasePoolMax");
  });

  it("throws when the pool size is absent rather than falling back to pg's own default", () => {
    expect(() => createService(new ConfigService({ databaseUrl: DATABASE_URL }))).toThrow();
  });

  it("connects on module init", async () => {
    const service = createService(
      new ConfigService({ databaseUrl: DATABASE_URL, databasePoolMax: 10 }),
    );
    const connect = jest.spyOn(service, "$connect").mockResolvedValue(undefined);

    await service.onModuleInit();

    expect(connect).toHaveBeenCalledTimes(1);
  });

  // The only place $disconnect can actually be proven. A SIGTERM test cannot: process
  // termination closes the sockets on its own, whether or not the hook ever ran.
  it("disconnects on module destroy", async () => {
    const service = createService(
      new ConfigService({ databaseUrl: DATABASE_URL, databasePoolMax: 10 }),
    );
    const disconnect = jest.spyOn(service, "$disconnect").mockResolvedValue(undefined);

    await service.onModuleDestroy();

    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
