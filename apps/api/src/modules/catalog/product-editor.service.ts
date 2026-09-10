import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { SeoService } from "../seo/seo.service";
import type { Prisma } from "../../prisma/generated/client";
import type { ProductEditorialEdit, ProductEditorQuery } from "./product-editor.dto";
import { productEditorialSections } from "./product-editorial-sections";

const productSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  categoryId: true,
  category: { select: { name: true } },
} as const;
@Injectable()
export class ProductEditorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly seo: SeoService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ProductEditorQuery): Promise<{ items: unknown[]; total: number }> {
    const where: Prisma.ProductWhereInput = {
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: "insensitive" } },
              { slug: { contains: query.q, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        select: productSelect,
        skip: (query.page - 1) * 20,
        take: 20,
        orderBy: [{ name: "asc" }, { id: "asc" }],
      }),
      this.prisma.product.count({ where }),
    ]);
    return { items, total };
  }
  async get(id: string): Promise<Record<string, unknown>> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: { ...productSelect, editorialDraft: true },
    });
    if (!product) throw new NotFoundException("Product not found.");
    return {
      id: product.id,
      slug: product.slug,
      category: product.category.name,
      revision: String(product.editorialDraft?.revision ?? 0),
      fields: product.editorialDraft?.content
        ? {
            ...productEditorialSections(product.editorialDraft.content),
            ...(product.editorialDraft.content as Record<string, unknown>),
          }
        : {
            ...productEditorialSections(product.editorialDraft?.publishedSections),
            name: product.name,
            description: product.description ?? "",
            seo: await this.seo.readProductEditorial(id),
          },
    };
  }
  async save(
    id: string,
    actorId: string,
    input: ProductEditorialEdit,
  ): Promise<{ revision: string; slug: string }> {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const product = await tx.product.findUnique({
            where: { id },
            select: { slug: true, editorialDraft: { select: { revision: true, content: true } } },
          });
          if (!product) throw new NotFoundException("Product not found.");
          if ((product.editorialDraft?.revision ?? 0) !== input.revision)
            throw new ConflictException("Product changed. Reload before saving.");
          const revision = input.revision + 1;
          const sections = productEditorialSections({
            ...productEditorialSections(product.editorialDraft?.content),
            ...Object.fromEntries(
              Object.entries(input.content).filter(([, value]) => value !== undefined),
            ),
          });
          const content = JSON.parse(
            JSON.stringify({ ...input.content, ...sections }),
          ) as Prisma.InputJsonValue;
          const published =
            input.action === "publish"
              ? { publishedSections: JSON.parse(JSON.stringify(sections)) as Prisma.InputJsonValue }
              : {};
          await tx.productEditorialDraft.upsert({
            where: { productId: id },
            create: { productId: id, revision, content, ...published },
            update: { revision, content, ...published },
          });
          if (input.action === "publish") {
            await tx.product.update({
              where: { id },
              data: { name: input.content.name, description: input.content.description || null },
            });
            await this.seo.publishProductEditorial(id, input.content.seo, tx);
          }
          await this.audit.append(
            {
              event: input.action === "publish" ? "product.published" : "product.draft_saved",
              actorId,
              subjectId: id,
              outcome: "success",
            },
            tx,
          );
          return { revision: String(revision), slug: product.slug };
        },
        { isolationLevel: "Serializable" },
      );
    } catch (error: unknown) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        ["P2002", "P2034", "P2025"].includes(String(error.code))
      )
        throw new ConflictException("Product changed. Reload before saving.");
      throw error;
    }
  }
}
