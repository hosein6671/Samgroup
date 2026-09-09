import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { UserRole, UserStatus } from "../../prisma/generated/client";
import { AuditService } from "../audit/audit.service";
import { PasswordService } from "./password.service";

const SELECT = { id: true, email: true, role: true, status: true, adminRevision: true } as const;
export type ManagedUser = {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  adminRevision: number;
};
@Injectable()
export class UserManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly audit: AuditService,
  ) {}
  async get(id: string): Promise<ManagedUser> {
    const row = await this.prisma.user.findUnique({ where: { id }, select: SELECT });
    if (!row) throw new NotFoundException("User not found.");
    return row;
  }
  async create(
    actorId: string,
    input: { email: string; password: string; role: UserRole },
  ): Promise<ManagedUser> {
    const passwordHash = await this.passwords.hash(input.password);
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const actor = await tx.user.findUnique({
            where: { id: actorId },
            select: { role: true, status: true },
          });
          if (actor?.role !== UserRole.ADMIN || actor.status !== UserStatus.ACTIVE)
            throw new ForbiddenException();
          const user = await tx.user.create({
            data: { email: input.email, passwordHash, role: input.role },
            select: SELECT,
          });
          await this.audit.append(
            { event: "user.created", outcome: "success", actorId, subjectId: user.id },
            tx,
          );
          return user;
        },
        { isolationLevel: "Serializable" },
      );
    } catch (error) {
      return this.handle(error);
    }
  }
  async update(
    actorId: string,
    id: string,
    input: { role: UserRole; status: UserStatus; revision: number },
  ): Promise<ManagedUser> {
    if (actorId === id)
      throw new ConflictException("Use another administrator to change your own account.");
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const actor = await tx.user.findUnique({
            where: { id: actorId },
            select: { role: true, status: true },
          });
          if (actor?.role !== UserRole.ADMIN || actor.status !== UserStatus.ACTIVE)
            throw new ForbiddenException();
          const previous = await tx.user.findUnique({ where: { id }, select: SELECT });
          if (!previous) throw new NotFoundException("User not found.");
          if (previous.adminRevision !== input.revision)
            throw new ConflictException("Account changed. Reload before saving.");
          if (
            previous.role === UserRole.ADMIN &&
            previous.status === UserStatus.ACTIVE &&
            (input.role !== UserRole.ADMIN || input.status !== UserStatus.ACTIVE)
          ) {
            const count = await tx.user.count({
              where: { role: UserRole.ADMIN, status: UserStatus.ACTIVE },
            });
            if (count <= 1)
              throw new ConflictException("At least one active administrator is required.");
          }
          if (previous.role === input.role && previous.status === input.status) return previous;
          const updated = await tx.user.update({
            where: { id, adminRevision: input.revision },
            data: { role: input.role, status: input.status, adminRevision: { increment: 1 } },
            select: SELECT,
          });
          if (previous.role !== input.role)
            await this.audit.append(
              { event: "user.role_changed", outcome: "success", actorId, subjectId: id },
              tx,
            );
          if (previous.status !== input.status)
            await this.audit.append(
              { event: "user.status_changed", outcome: "success", actorId, subjectId: id },
              tx,
            );
          // Disable revokes credentials/sessions through the existing database trigger (ADR-012).
          return updated;
        },
        { isolationLevel: "Serializable" },
      );
    } catch (error) {
      return this.handle(error);
    }
  }
  private handle(error: unknown): never {
    const code =
      typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
    if (code === "P2002") throw new ConflictException("An account already uses that email.");
    if (code === "P2034" || code === "P2025")
      throw new ConflictException("Account changed. Reload before saving.");
    throw error;
  }
}
