import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

export type ProductClassification = {
  readonly categoryId: string;
  readonly productTypeId: string | null;
  readonly families: readonly { id: string; name: string; slug: string }[];
  readonly types: readonly { id: string; name: string; slug: string }[];
};

/**
 * ADR-030: a product's Product Family and Product Type are Admin-owned after the initial import.
 *
 * Moving a product to another family clears its application group in the same statement, because
 * a group belongs to one family (ADR-029) and the database refuses a group of another family.
 * Segments are untouched: they describe the market, not the family.
 */
@Injectable()
export class ProductClassificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async get(productId: string): Promise<ProductClassification> {
    const [product, families, types] = await Promise.all([
      this.prisma.product.findUnique({
        where: { id: productId },
        select: { categoryId: true, productTypeId: true },
      }),
      this.prisma.category.findMany({
        where: { parentId: null },
        orderBy: { name: "asc" },
        select: { id: true, name: true, slug: true },
      }),
      this.prisma.productType.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, slug: true },
      }),
    ]);
    if (!product) throw new NotFoundException("Product not found.");
    return { ...product, families, types };
  }

  async set(
    actorId: string,
    productId: string,
    input: { categoryId: string; productTypeId: string | null },
  ): Promise<{ categoryId: string; productTypeId: string | null; groupCleared: boolean }> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { categoryId: true, productTypeId: true, applicationGroupId: true },
    });
    if (!product) throw new NotFoundException("Product not found.");
    const [family, type] = await Promise.all([
      this.prisma.category.findUnique({ where: { id: input.categoryId }, select: { id: true } }),
      input.productTypeId === null
        ? Promise.resolve({ id: null })
        : this.prisma.productType.findUnique({
            where: { id: input.productTypeId },
            select: { id: true },
          }),
    ]);
    if (!family) throw new BadRequestException("Choose an existing Product Family.");
    if (!type) throw new BadRequestException("Choose an existing Product Type.");
    const familyChanged = product.categoryId !== input.categoryId;
    const typeChanged = product.productTypeId !== input.productTypeId;
    if (!familyChanged && !typeChanged) return { ...input, groupCleared: false };
    const groupCleared = familyChanged && product.applicationGroupId !== null;
    await this.prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: productId },
        data: {
          categoryId: input.categoryId,
          productTypeId: input.productTypeId,
          ...(familyChanged ? { applicationGroupId: null } : {}),
        },
      });
      await this.audit.append(
        { event: "product.taxonomy_changed", actorId, subjectId: productId, outcome: "success" },
        tx,
      );
    });
    return { ...input, groupCleared };
  }
}
