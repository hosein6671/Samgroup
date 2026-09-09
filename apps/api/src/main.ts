import "reflect-metadata";

import { Logger, ValidationPipe } from "@nestjs/common";
import type { Request, Response, NextFunction } from "express";
import { AuditService } from "./modules/audit/audit.service";
import { securityEvent } from "./modules/audit/security-event";
import { AUTHENTICATED_USER } from "./modules/identity/authenticated-user";
import type { RequestWithUser } from "./modules/identity/authenticated-user";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import helmet from "helmet";

import { AppModule } from "./app.module";
import { validationExceptionFactory } from "./common/validation/validation-exception.factory";

async function bootstrap(): Promise<void> {
  // CORS stays off. web and api are served from one origin behind nginx (ADR-005) and no
  // browser-originated request ever reaches this API — every call is server-side from
  // Next.js (API_CONTRACT_FINAL.md §1). Enabling CORS would advertise a browser-reachable
  // surface the architecture says does not exist.
  const app = await NestFactory.create(AppModule, { cors: false });

  app.use(helmet());
  const audit = app.get(AuditService);
  const auditLogger = new Logger("SecurityAudit");
  app.use((request: Request & RequestWithUser, response: Response, next: NextFunction) => {
    response.once("finish", () => {
      const event = securityEvent(request.method, request.path, response.statusCode);
      if (event === null) return;
      // Authentication failures deliberately do not capture the supplied account identifier.
      void audit
        .append({
          event,
          outcome: response.statusCode < 400 ? "success" : "failure",
          actorId: request[AUTHENTICATED_USER]?.id,
          httpStatus: response.statusCode,
        })
        .catch(() => {
          // Operational signal only; never print the error, connection details or request.
          auditLogger.error("Security event persistence failed.");
        });
    });
    next();
  });

  // nginx proxies /api/ with a variable upstream and no URI component, so the full
  // original path arrives here — the prefix must include /api.
  app.setGlobalPrefix("api/v1");

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      // Nest's default factory reports failures as a flat string[] of sentences with the
      // field name readable only inside the prose. API_CONTRACT_FINAL.md §8 requires
      // details: [{field, issue}] the frontend can map back to a form input.
      exceptionFactory: validationExceptionFactory,
    }),
  );

  // Without this Nest ignores SIGTERM, so onModuleDestroy never runs and the Prisma
  // connection is torn down by process death instead of being closed. Docker stops
  // containers with SIGTERM, which makes this the normal shutdown path, not an edge case.
  app.enableShutdownHooks();

  await app.listen(app.get(ConfigService).getOrThrow<number>("apiPort"));
}

void bootstrap();
