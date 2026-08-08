import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import configuration from "./config/configuration";
import { validateEnv } from "./config/env.validation";
import { SystemModule } from "./modules/system/system.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validate: validateEnv,
    }),
    SystemModule,
  ],
})
export class AppModule {}
