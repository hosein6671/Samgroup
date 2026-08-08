import "reflect-metadata";

import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import helmet from "helmet";

import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  // CORS stays off. web and api are served from one origin behind nginx (ADR-005) and no
  // browser-originated request ever reaches this API — every call is server-side from
  // Next.js (API_CONTRACT_FINAL.md §1). Enabling CORS would advertise a browser-reachable
  // surface the architecture says does not exist.
  const app = await NestFactory.create(AppModule, { cors: false });

  app.use(helmet());

  // nginx proxies /api/ with a variable upstream and no URI component, so the full
  // original path arrives here — the prefix must include /api.
  app.setGlobalPrefix("api/v1");

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(app.get(ConfigService).getOrThrow<number>("apiPort"));
}

void bootstrap();
