import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "./generated/client";

/**
 * The single point of database access for the whole application — every module reaches
 * sam_platform through this service and never constructs a client of its own.
 *
 * Scope is sam_platform only. sam_cms belongs to Payload and is unreachable from here by
 * PostgreSQL grant, by the DATABASE_URL guard in config/env.validation.ts, and by the
 * absence of any model for it in the schema (ADR-002).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(configService: ConfigService) {
    // Prisma 7 has no built-in connection pool: a driver adapter is required for a direct
    // PostgreSQL connection, the same way prisma/seed.ts constructs its client.
    super({
      adapter: new PrismaPg({
        connectionString: configService.getOrThrow<string>("databaseUrl"),
      }),
    });
  }

  /**
   * Connects during startup rather than on first query.
   *
   * Measured, not assumed: this does NOT make an unreachable database fail the boot. The
   * pg pool behind the driver adapter opens sockets lazily, so with PostgreSQL stopped the
   * application still starts and /health still answers 200 — the failure surfaces at the
   * first real query instead. Verifying connectivity at startup would need an actual probe
   * query, which is not part of this step.
   */
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  /** Requires app.enableShutdownHooks() in main.ts; Nest does not listen for SIGTERM otherwise. */
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
