import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { MailModule } from "../../common/mail/mail.module";
import { AuditService } from "./audit.service";
import { SecurityAlertService } from "./security-alert.service";
@Module({
  imports: [PrismaModule, MailModule],
  providers: [AuditService, SecurityAlertService],
  exports: [AuditService],
})
export class AuditModule {}
