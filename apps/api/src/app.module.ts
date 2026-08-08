import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";

import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { ResponseEnvelopeInterceptor } from "./common/interceptors/response-envelope.interceptor";
import configuration from "./config/configuration";
import { validateEnv } from "./config/env.validation";
import { CatalogModule } from "./modules/catalog/catalog.module";
import { LocalizationModule } from "./modules/localization/localization.module";
import { SeoModule } from "./modules/seo/seo.module";
import { SystemModule } from "./modules/system/system.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validate: validateEnv,
    }),
    // Imported here so the connection opens and closes with the application, not because
    // AppModule queries anything. PrismaModule is not @Global: each future module that
    // needs the database imports it for itself.
    PrismaModule,
    LocalizationModule,
    CatalogModule,
    SeoModule,
    SystemModule,
  ],
  // Registered as providers rather than app.useGlobal*() in main.ts: a filter constructed
  // by hand gets no dependency injection, and AllExceptionsFilter needs HttpAdapterHost.
  providers: [
    { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
