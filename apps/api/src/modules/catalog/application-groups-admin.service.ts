import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { ContentEntityType } from "../../common/content/content-entity-type";
import { ContentTranslationService } from "../../common/content/content-translation.service";
import { TranslationStatus } from "../../prisma/generated/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

import type {
  ApplicationGroupCreate,
  ApplicationGroupUpdate,
} from "./application-groups-admin.dto";

export interface ApplicationGroupListItem {
  readonly id: string;
  readonly categoryId: string;
  readonly slug: string;
  readonly name: string;
  readonly sortOrder: number;
  readonly productCount: number;
  /** Names in every non-default locale that has one, keyed by locale code. */
  readonly translations: Record<string, string>;
}

/** The same ASCII slug transform the Segment admin uses (ADR-026); the slug is never a URL path. */
function slugifyName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isPrismaError(error: unknown, code: string): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === code);
}

/**
 * ADR-029: Admin-managed application groups within a Product Family, and a product's assignment
 * to one. Group structure is Admin only (the controller enforces it); assignment is open to
 * Content Manager as well, like Segment assignment in the product editor.
 */
@Injectable()
export class ApplicationGroupsAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly translations: ContentTranslationService,
  ) {}

  async list(categoryId?: string): Promise<ApplicationGroupListItem[]> {
    const rows = await this.prisma.applicationGroup.findMany({
      where: categoryId ? { categoryId } : {},
      orderBy: [{ categoryId: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        categoryId: true,
        slug: true,
        name: true,
        sortOrder: true,
        _count: { select: { products: true } },
      },
    });
    const names = await this.prisma.contentTranslation.findMany({
      where: {
        entityType: ContentEntityType.ApplicationGroup,
        entityId: { in: rows.map((row) => row.id) },
        field: "name",
      },
      select: { entityId: true, locale: true, value: true },
    });
    return rows.map((row) => ({
      id: row.id,
      categoryId: row.categoryId,
      slug: row.slug,
      name: row.name,
      sortOrder: row.sortOrder,
      productCount: row._count.products,
      translations: Object.fromEntries(
        names.filter((name) => name.entityId === row.id).map((name) => [name.locale, name.value]),
      ),
    }));
  }

  async create(actorId: string, input: ApplicationGroupCreate): Promise<ApplicationGroupListItem> {
    const name = input.name.trim();
    const slug = slugifyName(name);
    if (!slug)
      throw new BadRequestException(
        "That name does not produce a usable identifier. Add a letter or number.",
      );
    const category = await this.prisma.category.findUnique({
      where: { id: input.categoryId },
      select: { id: true },
    });
    if (!category) throw new NotFoundException("Product family not found.");
    try {
      return await this.prisma.$transaction(async (tx) => {
        const last = await tx.applicationGroup.aggregate({
          where: { categoryId: input.categoryId },
          _max: { sortOrder: true },
        });
        const group = await tx.applicationGroup.create({
          data: {
            categoryId: input.categoryId,
            name,
            slug,
            sortOrder: (last._max.sortOrder ?? 0) + 1,
          },
          select: { id: true, categoryId: true, slug: true, name: true, sortOrder: true },
        });
        await this.audit.append(
          { event: "application_group.created", actorId, subjectId: group.id, outcome: "success" },
          tx,
        );
        return { ...group, productCount: 0, translations: {} };
      });
    } catch (error: unknown) {
      if (isPrismaError(error, "P2002"))
        throw new ConflictException(`This family already has a group "${slug}".`);
      throw error;
    }
  }

  async update(
    actorId: string,
    id: string,
    input: ApplicationGroupUpdate,
    locale: { code: string; isDefault: boolean },
  ): Promise<void> {
    const group = await this.prisma.applicationGroup.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!group) throw new NotFoundException("Group not found.");
    await this.prisma.$transaction(async (tx) => {
      const name = input.name?.trim();
      if (name !== undefined && !locale.isDefault)
        await this.translations.publishField(
          ContentEntityType.ApplicationGroup,
          id,
          locale.code,
          "name",
          name,
          TranslationStatus.HUMAN_REVIEWED,
          tx,
        );
      const data = {
        ...(name !== undefined && locale.isDefault ? { name } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      };
      if (Object.keys(data).length > 0) await tx.applicationGroup.update({ where: { id }, data });
      await this.audit.append(
        { event: "application_group.updated", actorId, subjectId: id, outcome: "success" },
        tx,
      );
    });
  }

  async remove(actorId: string, id: string): Promise<void> {
    const group = await this.prisma.applicationGroup.findUnique({
      where: { id },
      select: { _count: { select: { products: true } } },
    });
    if (!group) throw new NotFoundException("Group not found.");
    if (group._count.products > 0)
      throw new ConflictException(
        "Move this group's products to another group before deleting it.",
      );
    await this.prisma.$transaction(async (tx) => {
      await tx.contentTranslation.deleteMany({
        where: { entityType: ContentEntityType.ApplicationGroup, entityId: id },
      });
      await tx.applicationGroup.delete({ where: { id } });
      await this.audit.append(
        { event: "application_group.deleted", actorId, subjectId: id, outcome: "success" },
        tx,
      );
    });
  }

  /** The product's group and the groups of its own family it may move to. */
  async forProduct(
    productId: string,
  ): Promise<{ assigned: string | null; available: { id: string; name: string; slug: string }[] }> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { applicationGroupId: true, categoryId: true },
    });
    if (!product) throw new NotFoundException("Product not found.");
    const available = await this.prisma.applicationGroup.findMany({
      where: { categoryId: product.categoryId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true },
    });
    return { assigned: product.applicationGroupId, available };
  }

  async assign(actorId: string, productId: string, groupId: string | null): Promise<void> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { categoryId: true },
    });
    if (!product) throw new NotFoundException("Product not found.");
    if (groupId !== null) {
      const group = await this.prisma.applicationGroup.findUnique({
        where: { id: groupId },
        select: { categoryId: true },
      });
      // Checked here for a readable message; the database trigger is the enforcement.
      if (!group || group.categoryId !== product.categoryId)
        throw new BadRequestException("Choose a group of this product's own family.");
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.product.update({ where: { id: productId }, data: { applicationGroupId: groupId } });
      await this.audit.append(
        {
          event: "product.application_group_changed",
          actorId,
          subjectId: productId,
          outcome: "success",
        },
        tx,
      );
    });
  }
}
