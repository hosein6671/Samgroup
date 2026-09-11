import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../../prisma/prisma.service";
import type { Prisma } from "../../prisma/generated/client";
import { AuditService } from "../audit/audit.service";
import { SeoService } from "../seo/seo.service";
import { MediaService } from "../media/media.service";
import type {
  BlogAdminQuery,
  BlogEditorialContent,
  BlogEditorialEdit,
  BlogPostCreate,
  BlogReferenceCreate,
} from "./blog-admin.dto";

const referencesSelect = { id: true, name: true, slug: true } as const;

@Injectable()
export class BlogAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly seo: SeoService,
    private readonly audit: AuditService,
    private readonly media: MediaService,
  ) {}

  async images(id: string): Promise<unknown[]> {
    await this.assertPost(id);
    return this.media.listBlogImages(id);
  }

  async uploadImage(
    id: string,
    file: { buffer: Buffer; mimetype: string; originalname: string; size: number },
    altText: string,
    actorId: string,
  ): Promise<Record<string, unknown>> {
    await this.assertPost(id);
    return this.media.uploadBlogImage(id, file, altText, actorId);
  }

  async setPrimaryImage(id: string, imageId: string, actorId: string): Promise<void> {
    await this.assertPost(id);
    await this.media.setPrimaryBlogImage(id, imageId, actorId);
  }

  async deleteImage(id: string, imageId: string, actorId: string): Promise<void> {
    await this.assertPost(id);
    await this.media.deleteBlogImage(id, imageId, actorId);
  }

  async list(query: BlogAdminQuery): Promise<{ items: unknown[]; total: number }> {
    const where: Prisma.BlogPostWhereInput = {
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.status === "published" ? { publishedAt: { not: null, lte: new Date() } } : {}),
      ...(query.status === "draft" ? { publishedAt: null } : {}),
      ...(query.q
        ? {
            OR: [
              { title: { contains: query.q, mode: "insensitive" } },
              { slug: { contains: query.q, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.blogPost.findMany({
        where,
        skip: (query.page - 1) * 20,
        take: 20,
        orderBy: [{ publishedAt: "desc" }, { title: "asc" }, { id: "asc" }],
        select: {
          id: true,
          title: true,
          slug: true,
          publishedAt: true,
          category: { select: referencesSelect },
          editorialDraft: { select: { revision: true, updatedAt: true } },
        },
      }),
      this.prisma.blogPost.count({ where }),
    ]);
    return { items, total };
  }

  categories(): Promise<unknown[]> {
    return this.prisma.blogCategory.findMany({
      select: referencesSelect,
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
  }

  tags(): Promise<unknown[]> {
    return this.prisma.blogTag.findMany({
      select: referencesSelect,
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
  }

  async createCategory(
    actorId: string,
    input: BlogReferenceCreate,
  ): Promise<Record<string, unknown>> {
    return this.createReference("category", actorId, input);
  }

  async createTag(actorId: string, input: BlogReferenceCreate): Promise<Record<string, unknown>> {
    return this.createReference("tag", actorId, input);
  }

  async get(id: string): Promise<Record<string, unknown>> {
    const post = await this.prisma.blogPost.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        slug: true,
        content: true,
        categoryId: true,
        publishedAt: true,
        tags: { select: { blogTagId: true } },
        editorialDraft: true,
      },
    });
    if (!post) throw new NotFoundException("Post not found.");
    return {
      id: post.id,
      revision: String(post.editorialDraft?.revision ?? 0),
      publishedAt: post.publishedAt?.toISOString() ?? null,
      fields: post.editorialDraft?.content ?? {
        title: post.title,
        slug: post.slug,
        content: post.content,
        categoryId: post.categoryId,
        tagIds: post.tags.map((tag) => tag.blogTagId),
        seo: await this.seo.readBlogEditorial(id),
      },
    };
  }

  async create(actorId: string, input: BlogPostCreate): Promise<{ id: string; revision: string }> {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          await this.assertReferences(tx, input.content);
          const post = await tx.blogPost.create({
            data: {
              title: input.content.title,
              slug: input.content.slug,
              content: input.content.content,
              categoryId: input.content.categoryId,
              authorId: actorId,
              publishedAt: null,
              editorialDraft: { create: { revision: 1, content: this.toJson(input.content) } },
            },
            select: { id: true },
          });
          await this.audit.append(
            { event: "blog.post_created", actorId, subjectId: post.id, outcome: "success" },
            tx,
          );
          return { id: post.id, revision: "1" };
        },
        { isolationLevel: "Serializable" },
      );
    } catch (error: unknown) {
      this.rethrowConflict(error, "An article with this slug already exists.");
    }
  }

  async save(
    id: string,
    actorId: string,
    input: BlogEditorialEdit,
  ): Promise<{ revision: string; slug: string }> {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const post = await tx.blogPost.findUnique({
            where: { id },
            select: {
              slug: true,
              publishedAt: true,
              editorialDraft: { select: { revision: true } },
            },
          });
          if (!post) throw new NotFoundException("Post not found.");
          if ((post.editorialDraft?.revision ?? 0) !== input.revision)
            throw new ConflictException("Article changed. Reload before saving.");
          await this.assertReferences(tx, input.content);
          const revision = input.revision + 1;
          await tx.blogEditorialDraft.upsert({
            where: { blogPostId: id },
            create: { blogPostId: id, revision, content: this.toJson(input.content) },
            update: { revision, content: this.toJson(input.content) },
          });
          if (input.action === "publish") {
            await tx.blogPost.update({
              where: { id },
              data: {
                title: input.content.title,
                slug: input.content.slug,
                content: input.content.content,
                categoryId: input.content.categoryId,
                publishedAt: post.publishedAt ?? new Date(),
                tags: {
                  deleteMany: {},
                  create: [...new Set(input.content.tagIds)].map((blogTagId) => ({ blogTagId })),
                },
              },
            });
            await this.seo.publishBlogEditorial(id, input.content.seo, tx);
          }
          await this.audit.append(
            {
              event: input.action === "publish" ? "blog.published" : "blog.draft_saved",
              actorId,
              subjectId: id,
              outcome: "success",
            },
            tx,
          );
          return {
            revision: String(revision),
            slug: input.action === "publish" ? input.content.slug : post.slug,
          };
        },
        { isolationLevel: "Serializable" },
      );
    } catch (error: unknown) {
      this.rethrowConflict(
        error,
        "Article changed or its slug is already in use. Reload before saving.",
      );
    }
  }

  private async assertReferences(
    tx: Prisma.TransactionClient,
    content: BlogEditorialContent,
  ): Promise<void> {
    const uniqueTagIds = [...new Set(content.tagIds)];
    const [category, tagCount] = await Promise.all([
      tx.blogCategory.findUnique({ where: { id: content.categoryId }, select: { id: true } }),
      tx.blogTag.count({ where: { id: { in: uniqueTagIds } } }),
    ]);
    if (!category) throw new NotFoundException("Blog category not found.");
    if (tagCount !== uniqueTagIds.length)
      throw new NotFoundException("One or more blog tags were not found.");
  }

  private async assertPost(id: string): Promise<void> {
    if (!(await this.prisma.blogPost.findUnique({ where: { id }, select: { id: true } })))
      throw new NotFoundException("Post not found.");
  }

  private async createReference(
    kind: "category" | "tag",
    actorId: string,
    input: BlogReferenceCreate,
  ): Promise<Record<string, unknown>> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const item =
          kind === "category"
            ? await tx.blogCategory.create({ data: input, select: referencesSelect })
            : await tx.blogTag.create({ data: input, select: referencesSelect });
        await this.audit.append(
          {
            event: kind === "category" ? "blog.category_created" : "blog.tag_created",
            actorId,
            subjectId: item.id,
            outcome: "success",
          },
          tx,
        );
        return item;
      });
    } catch (error: unknown) {
      this.rethrowConflict(error, `A blog ${kind} with this slug already exists.`);
    }
  }

  private toJson(content: BlogEditorialContent): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(content)) as Prisma.InputJsonValue;
  }

  private rethrowConflict(error: unknown, message: string): never {
    if (error instanceof ConflictException || error instanceof NotFoundException) throw error;
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      ["P2002", "P2034", "P2025"].includes(String(error.code))
    )
      throw new ConflictException(message);
    throw error;
  }
}
