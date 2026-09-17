import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { RedirectCreate, RedirectUpdate } from "./redirects-admin.dto";

export interface RedirectRow {
  readonly id: string;
  readonly fromPath: string;
  readonly toPath: string;
  readonly statusCode: number;
  readonly locale: string | null;
  readonly isActive: boolean;
}

const select = {
  id: true,
  fromPath: true,
  toPath: true,
  statusCode: true,
  locale: true,
  isActive: true,
} as const;

/**
 * Admin CRUD for `Redirect` (API_CONTRACT_FINAL.md §2.10's `/admin/redirects` row) — the write
 * half of `RedirectsService`'s public, active-only read. Separate service and separate
 * controller: the two answer different callers (an authenticated operator managing rules vs.
 * `apps/web` middleware reading them) and the public read must stay untouched by anything
 * written here.
 */
@Injectable()
export class RedirectsAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(): Promise<RedirectRow[]> {
    return this.prisma.redirect.findMany({
      orderBy: [{ fromPath: "asc" }, { locale: "asc" }],
      select,
    });
  }

  async create(actorId: string, input: RedirectCreate): Promise<RedirectRow> {
    if (input.fromPath === input.toPath)
      throw new BadRequestException("A redirect cannot point a path at itself.");
    try {
      return await this.prisma.$transaction(async (tx) => {
        const redirect = await tx.redirect.create({
          data: {
            fromPath: input.fromPath,
            toPath: input.toPath,
            statusCode: input.statusCode ?? 301,
            locale: input.locale ?? null,
            isActive: input.isActive ?? true,
          },
          select,
        });
        await this.audit.append(
          { event: "redirect.created", actorId, subjectId: redirect.id, outcome: "success" },
          tx,
        );
        return redirect;
      });
    } catch (error: unknown) {
      if (error && typeof error === "object" && "code" in error && error.code === "P2002")
        throw new ConflictException("A redirect already exists for that path and locale.");
      if (error && typeof error === "object" && "code" in error && error.code === "P2003")
        throw new BadRequestException("That locale does not exist.");
      throw error;
    }
  }

  async update(id: string, actorId: string, input: RedirectUpdate): Promise<RedirectRow> {
    const existing = await this.prisma.redirect.findUnique({
      where: { id },
      select: { id: true, fromPath: true },
    });
    if (!existing) throw new NotFoundException("Redirect not found.");
    if (input.toPath !== undefined && input.toPath === existing.fromPath)
      throw new BadRequestException("A redirect cannot point a path at itself.");
    return this.prisma.$transaction(async (tx) => {
      const redirect = await tx.redirect.update({
        where: { id },
        data: {
          ...(input.toPath !== undefined && { toPath: input.toPath }),
          ...(input.statusCode !== undefined && { statusCode: input.statusCode }),
          ...(input.isActive !== undefined && { isActive: input.isActive }),
        },
        select,
      });
      await this.audit.append(
        { event: "redirect.updated", actorId, subjectId: id, outcome: "success" },
        tx,
      );
      return redirect;
    });
  }

  async remove(id: string, actorId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const deleted = await tx.redirect
        .delete({ where: { id }, select: { id: true } })
        .catch(() => null);
      if (!deleted) throw new NotFoundException("Redirect not found.");
      await this.audit.append(
        { event: "redirect.deleted", actorId, subjectId: id, outcome: "success" },
        tx,
      );
    });
  }
}
