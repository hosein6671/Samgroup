import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { Prisma } from "../../prisma/generated/client";

export type AuditEventName =
  | "product.draft_saved"
  | "product.published"
  | "product.image_uploaded"
  | "product.image_primary_changed"
  | "product.image_removed"
  | "auth.login"
  | "auth.refresh"
  | "auth.logout"
  | "access.denied"
  | "user.created"
  | "user.role_changed"
  | "user.status_changed";
export type AuditEntry = {
  event: AuditEventName;
  outcome: "success" | "failure";
  actorId?: string;
  subjectId?: string;
  httpStatus?: number;
};

export type AuditFilters = {
  actorId?: string;
  event?: AuditEventName;
  outcome?: "success" | "failure";
  from?: string;
  to?: string;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}
  async append(entry: AuditEntry, transaction?: Prisma.TransactionClient): Promise<void> {
    // Explicit projection: even an untyped caller cannot persist request bodies or secrets.
    await (transaction ?? this.prisma).adminAuditEvent.create({
      data: {
        event: entry.event,
        outcome: entry.outcome,
        actorId: entry.actorId,
        subjectId: entry.subjectId,
        httpStatus: entry.httpStatus,
      },
    });
  }
  async list(
    page: number,
    filters: AuditFilters = {},
  ): Promise<{
    items: {
      id: string;
      occurredAt: Date;
      actorId: string | null;
      subjectId: string | null;
      event: string;
      outcome: string;
      httpStatus: number | null;
    }[];
    total: number;
  }> {
    const where: Prisma.AdminAuditEventWhereInput = {
      actorId: filters.actorId,
      event: filters.event,
      outcome: filters.outcome,
      occurredAt: {
        ...(filters.from ? { gte: new Date(filters.from) } : {}),
        ...(filters.to ? { lte: new Date(filters.to) } : {}),
      },
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.adminAuditEvent.findMany({
        where,
        skip: (page - 1) * 50,
        take: 50,
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          occurredAt: true,
          actorId: true,
          subjectId: true,
          event: true,
          outcome: true,
          httpStatus: true,
        },
      }),
      this.prisma.adminAuditEvent.count({ where }),
    ]);
    return { items, total };
  }
}
