import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";

import { ContentEntityType } from "../../common/content/content-entity-type";
import { ContentTranslationService } from "../../common/content/content-translation.service";
import { TranslationStatus } from "../../prisma/generated/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { SeoService } from "../seo/seo.service";

import type { Prisma } from "../../prisma/generated/client";
import type { ProductEditorialEdit } from "./product-editor.dto";
import { productEditorialSections } from "./product-editorial-sections";

const STATUS_FROM_WIRE = {
  machine_draft: TranslationStatus.MACHINE_DRAFT,
  human_reviewed: TranslationStatus.HUMAN_REVIEWED,
} as const;

const STATUS_TO_WIRE = {
  [TranslationStatus.MACHINE_DRAFT]: "machine_draft",
  [TranslationStatus.HUMAN_REVIEWED]: "human_reviewed",
} as const;

/**
 * The product editor for ONE non-default locale (ADR-027 §3).
 *
 * Kept apart from `ProductEditorService` on purpose: the default locale's editor writes the
 * product's own columns (name, description) and its draft row, and none of that may happen
 * here. A non-default locale edits only its own description translation, its own sections and
 * its own SEO row. The product name is shown, never written — names are not translated.
 *
 * Callers resolve the locale first and only route a NON-default locale here; the database
 * trigger on `product_editorial_localizations` refuses the default locale regardless.
 */
@Injectable()
export class ProductEditorLocalizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly seo: SeoService,
    private readonly audit: AuditService,
    private readonly translations: ContentTranslationService,
  ) {}

  async get(id: string, locale: string): Promise<Record<string, unknown>> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        category: { select: { name: true } },
        editorialLocalizations: { where: { locale } },
      },
    });
    if (!product) throw new NotFoundException("Product not found.");
    const row = product.editorialLocalizations[0];
    const fields = row?.content
      ? {
          ...productEditorialSections(row.content),
          ...(row.content as Record<string, unknown>),
        }
      : {
          ...productEditorialSections(row?.publishedSections),
          description:
            (await this.translations.readField(
              ContentEntityType.Product,
              id,
              locale,
              "description",
            )) ?? "",
          seo: await this.seo.readProductEditorial(id, locale),
        };
    return {
      id: product.id,
      slug: product.slug,
      category: product.category.name,
      locale,
      revision: String(row?.revision ?? 0),
      translationStatus: STATUS_TO_WIRE[row?.translationStatus ?? TranslationStatus.MACHINE_DRAFT],
      // The name is the approved catalogue name in every locale (ADR-027 §2): always the
      // product's own column, whatever an older draft may have carried.
      fields: { ...fields, name: product.name },
    };
  }

  async save(
    id: string,
    locale: string,
    actorId: string | undefined,
    input: ProductEditorialEdit,
  ): Promise<{ revision: string; slug: string }> {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const product = await tx.product.findUnique({
            where: { id },
            select: {
              name: true,
              slug: true,
              editorialLocalizations: {
                where: { locale },
                select: { revision: true, content: true, translationStatus: true },
              },
            },
          });
          if (!product) throw new NotFoundException("Product not found.");
          const current = product.editorialLocalizations[0];
          if ((current?.revision ?? 0) !== input.revision)
            throw new ConflictException("Product changed. Reload before saving.");
          const revision = input.revision + 1;
          const sections = productEditorialSections({
            ...productEditorialSections(current?.content),
            ...Object.fromEntries(
              Object.entries(input.content).filter(([, value]) => value !== undefined),
            ),
          });
          // `name` is stored as the product's own name, never as a translation: the editor
          // submits one because the shared DTO requires it, and it is overwritten here.
          const content = JSON.parse(
            JSON.stringify({ ...input.content, ...sections, name: product.name }),
          ) as Prisma.InputJsonValue;
          const translationStatus = input.translationStatus
            ? STATUS_FROM_WIRE[input.translationStatus]
            : (current?.translationStatus ?? TranslationStatus.MACHINE_DRAFT);
          const published =
            input.action === "publish"
              ? { publishedSections: JSON.parse(JSON.stringify(sections)) as Prisma.InputJsonValue }
              : {};
          await tx.productEditorialLocalization.upsert({
            where: { productId_locale: { productId: id, locale } },
            create: { productId: id, locale, revision, content, translationStatus, ...published },
            update: { revision, content, translationStatus, ...published },
          });
          if (input.action === "publish") {
            await this.translations.publishField(
              ContentEntityType.Product,
              id,
              locale,
              "description",
              input.content.description,
              translationStatus,
              tx,
            );
            await this.seo.publishProductEditorial(id, input.content.seo, tx, locale);
          }
          await this.audit.append(
            {
              event:
                input.action === "publish"
                  ? "product.localization_published"
                  : "product.localization_draft_saved",
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
