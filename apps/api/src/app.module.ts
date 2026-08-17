import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";
import { ThrottlerModule } from "@nestjs/throttler";

import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { ResponseEnvelopeInterceptor } from "./common/interceptors/response-envelope.interceptor";
import { THROTTLE_OPTIONS } from "./common/throttling/throttle.config";
import configuration from "./config/configuration";
import { validateEnv } from "./config/env.validation";
import { BlogModule } from "./modules/blog/blog.module";
import { CatalogModule } from "./modules/catalog/catalog.module";
import { ContentModule } from "./modules/content/content.module";
import { FormsModule } from "./modules/forms/forms.module";
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
    /*
     * The rate-limit policy — API_CONTRACT_FINAL.md §Rate limits, configured in
     * common/throttling/throttle.config.ts.
     *
     * **`ThrottlerGuard` is deliberately NOT registered as an APP_GUARD here.** Registering it
     * would throttle every public GET on the platform, and §Rate limits gives reads their own far
     * looser budget (100/min) that nothing in this gate implements. The guard is attached with
     * `@UseGuards` on the two Forms controllers instead, which are the only endpoints that write.
     *
     * The module is registered at this level rather than inside FormsModule because
     * `ThrottlerModule` is `@Global()` — putting a global registration inside a feature module
     * would misrepresent its scope — and because the policy is API-wide even while only one group
     * enforces a part of it.
     */
    ThrottlerModule.forRoot(THROTTLE_OPTIONS),
    // Imported here so the connection opens and closes with the application, not because
    // AppModule queries anything. PrismaModule is not @Global: each future module that
    // needs the database imports it for itself.
    PrismaModule,
    LocalizationModule,
    CatalogModule,
    BlogModule,
    ContentModule,
    FormsModule,
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
