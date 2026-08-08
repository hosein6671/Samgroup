import { Module } from "@nestjs/common";

import { PrismaService } from "./prisma.service";

/**
 * Deliberately not @Global(). A module that reads or writes sam_platform must import this
 * one explicitly, so database access stays visible in each module's own declaration rather
 * than being ambient — which is what keeps the modular-monolith boundaries in
 * ARCHITECTURE.md auditable as more modules arrive.
 *
 * AppModule imports it so the connection lifecycle runs even before any consumer exists.
 */
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
