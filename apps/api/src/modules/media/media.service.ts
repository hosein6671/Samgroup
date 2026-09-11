import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";

import { MediaType } from "../../prisma/generated/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

import type { MediaImageResponse } from "./dto/media.response";
import { ContentEntityType } from "../../common/content/content-entity-type";

/**
 * Owns the `media` table in sam_platform — ARCHITECTURE.md §Modules names Media as a module
 * boundary, and RAG_ARCHITECTURE.md §Sources already names "the NestJS Media module API" as
 * the way `Media` records are reached. Every other module goes through this service rather
 * than through `prisma.media`.
 *
 * Read-only, and deliberately narrow. `POST /media/upload` (API_CONTRACT_FINAL.md §2.6) and
 * the admin surface are not built here.
 *
 * **There is no generic accessor, and that is the point.** `media` is polymorphic — one table
 * holding product imagery next to customer-uploaded formulation specifications
 * (`CustomFormulationRequest.attachmentMediaId`) and CVs (`JobApplication.cvMediaId`).
 * RAG_IMPLEMENTATION_ARCHITECTURE.md §4 calls an unfiltered read of this table "the trap" and
 * "the most likely way this system gets built wrong", and requires the owner filter to be an
 * allow-list rather than a deny-list. A `findAll`, a `findById`, or an owner-agnostic
 * `findByOwner` would each be the accessor that makes that mistake reachable, so none exists.
 */
@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config?: ConfigService,
    private readonly audit?: AuditService,
  ) {}

  /**
   * The public images owned by one entity.
   *
   * `ownerType` is required and has no default: a defaulted owner type is exactly how a caller
   * ends up reading rows it never named. Both halves of the polymorphic key must be stated by
   * the caller, which is what makes the allow-list above hold at every call site.
   *
   * The `type` filter is applied here and cannot be overridden by a caller, so nothing can be
   * widened by adding a media row — a new document type is excluded by default.
   *
   * Ordered by id because `media` carries no sort or timestamp column; the value is arbitrary
   * but the ORDER is stable, which is what a gallery needs.
   */
  findImagesForOwner(ownerType: ContentEntityType, ownerId: string): Promise<MediaImageResponse[]> {
    return this.prisma.media.findMany({
      // Matches @@index([ownerType, ownerId]).
      where: { ownerType, ownerId, type: MediaType.IMAGE },
      orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
      select: { id: true, url: true, altText: true },
    });
  }

  listProductImages(productId: string): Promise<unknown[]> {
    return this.listOwnedImages(ContentEntityType.Product, productId);
  }

  listBlogImages(blogPostId: string): Promise<unknown[]> {
    return this.listOwnedImages(ContentEntityType.BlogPost, blogPostId);
  }

  private listOwnedImages(ownerType: ContentEntityType, ownerId: string): Promise<unknown[]> {
    return this.prisma.media.findMany({
      where: { ownerType, ownerId, type: MediaType.IMAGE },
      orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
      select: { id: true, url: true, altText: true, sortOrder: true, isPrimary: true },
    });
  }

  async uploadProductImage(
    productId: string,
    file: { buffer: Buffer; mimetype: string; originalname: string; size: number },
    altText: string,
    actorId: string,
  ): Promise<Record<string, unknown>> {
    return this.uploadOwnedImage(
      ContentEntityType.Product,
      productId,
      "products",
      file,
      altText,
      actorId,
      "product.image_uploaded",
    );
  }

  async uploadBlogImage(
    blogPostId: string,
    file: { buffer: Buffer; mimetype: string; originalname: string; size: number },
    altText: string,
    actorId: string,
  ): Promise<Record<string, unknown>> {
    return this.uploadOwnedImage(
      ContentEntityType.BlogPost,
      blogPostId,
      "blog",
      file,
      altText,
      actorId,
      "blog.image_uploaded",
    );
  }

  private async uploadOwnedImage(
    ownerType: ContentEntityType,
    ownerId: string,
    storageFolder: "products" | "blog",
    file: { buffer: Buffer; mimetype: string; originalname: string; size: number },
    altText: string,
    actorId: string,
    event: "product.image_uploaded" | "blog.image_uploaded",
  ): Promise<Record<string, unknown>> {
    const extensions: Record<string, string> = {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/webp": ".webp",
      "image/avif": ".avif",
    };
    const extension = extensions[file.mimetype];
    if (!extension || !altText.trim() || altText.length > 300)
      throw new BadRequestException("Choose a supported image and enter descriptive alt text.");
    if (!file.buffer.length || file.size > 5 * 1024 * 1024)
      throw new BadRequestException("Image must be no larger than 5 MB.");
    const matches =
      (file.mimetype === "image/jpeg" && file.buffer[0] === 0xff && file.buffer[1] === 0xd8) ||
      (file.mimetype === "image/png" &&
        file.buffer.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))) ||
      (file.mimetype === "image/webp" &&
        file.buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
        file.buffer.subarray(8, 12).toString("ascii") === "WEBP") ||
      (file.mimetype === "image/avif" && file.buffer.subarray(4, 8).toString("ascii") === "ftyp");
    if (!matches) throw new BadRequestException("Image content does not match its file type.");

    const storage = this.storage();
    const key = `${storageFolder}/${ownerId}/${randomUUID()}${extension}`;
    const client = this.client(storage);
    try {
      await client.send(
        new PutObjectCommand({
          Bucket: storage.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
          CacheControl: "public, max-age=31536000, immutable",
        }),
      );
      if (!this.audit) throw new ServiceUnavailableException("Media audit is unavailable.");
      const audit = this.audit;
      return await this.prisma.$transaction(async (tx) => {
        const count = await tx.media.count({
          where: {
            ownerType,
            ownerId,
            type: MediaType.IMAGE,
          },
        });
        const created = await tx.media.create({
          data: {
            url: `/media/${key}`,
            type: MediaType.IMAGE,
            altText: altText.trim(),
            ownerType,
            ownerId,
            sortOrder: count,
            isPrimary: count === 0,
          },
          select: { id: true, url: true, altText: true, sortOrder: true, isPrimary: true },
        });
        await audit.append({ event, actorId, subjectId: ownerId, outcome: "success" }, tx);
        return created;
      });
    } catch {
      await client
        .send(new DeleteObjectCommand({ Bucket: storage.bucket, Key: key }))
        .catch(() => undefined);
      throw new ServiceUnavailableException("Image could not be stored.");
    }
  }

  async setPrimaryProductImage(productId: string, imageId: string, actorId: string): Promise<void> {
    return this.setPrimaryOwnedImage(
      ContentEntityType.Product,
      productId,
      imageId,
      actorId,
      "product.image_primary_changed",
    );
  }

  async setPrimaryBlogImage(blogPostId: string, imageId: string, actorId: string): Promise<void> {
    return this.setPrimaryOwnedImage(
      ContentEntityType.BlogPost,
      blogPostId,
      imageId,
      actorId,
      "blog.image_primary_changed",
    );
  }

  private async setPrimaryOwnedImage(
    ownerType: ContentEntityType,
    ownerId: string,
    imageId: string,
    actorId: string,
    event: "product.image_primary_changed" | "blog.image_primary_changed",
  ): Promise<void> {
    if (!this.audit) throw new ServiceUnavailableException("Media audit is unavailable.");
    const audit = this.audit;
    await this.prisma.$transaction(async (tx) => {
      const image = await tx.media.findFirst({
        where: {
          id: imageId,
          ownerType,
          ownerId,
          type: MediaType.IMAGE,
        },
        select: { id: true },
      });
      if (!image) throw new BadRequestException("Image not found.");
      await tx.media.updateMany({
        where: { ownerType, ownerId, type: MediaType.IMAGE },
        data: { isPrimary: false },
      });
      await tx.media.update({ where: { id: imageId }, data: { isPrimary: true } });
      await audit.append(
        {
          event,
          actorId,
          subjectId: ownerId,
          outcome: "success",
        },
        tx,
      );
    });
  }

  async deleteProductImage(productId: string, imageId: string, actorId: string): Promise<void> {
    return this.deleteOwnedImage(
      ContentEntityType.Product,
      productId,
      "products",
      imageId,
      actorId,
      "product.image_removed",
    );
  }

  async deleteBlogImage(blogPostId: string, imageId: string, actorId: string): Promise<void> {
    return this.deleteOwnedImage(
      ContentEntityType.BlogPost,
      blogPostId,
      "blog",
      imageId,
      actorId,
      "blog.image_removed",
    );
  }

  private async deleteOwnedImage(
    ownerType: ContentEntityType,
    ownerId: string,
    storageFolder: "products" | "blog",
    imageId: string,
    actorId: string,
    event: "product.image_removed" | "blog.image_removed",
  ): Promise<void> {
    if (!this.audit) throw new ServiceUnavailableException("Media audit is unavailable.");
    const audit = this.audit;
    const image = await this.prisma.media.findFirst({
      where: {
        id: imageId,
        ownerType,
        ownerId,
        type: MediaType.IMAGE,
      },
      select: { id: true, url: true, isPrimary: true },
    });
    if (!image) throw new BadRequestException("Image not found.");
    await this.prisma.$transaction(async (tx) => {
      await tx.media.delete({ where: { id: image.id } });
      if (image.isPrimary) {
        const next = await tx.media.findFirst({
          where: {
            ownerType,
            ownerId,
            type: MediaType.IMAGE,
          },
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
          select: { id: true },
        });
        if (next) await tx.media.update({ where: { id: next.id }, data: { isPrimary: true } });
      }
      await audit.append({ event, actorId, subjectId: ownerId, outcome: "success" }, tx);
    });
    const key = image.url.replace(/^\/media\//, "");
    const storage = this.storage();
    if (image.url.startsWith(`/media/${storageFolder}/${ownerId}/`))
      await this.client(storage)
        .send(new DeleteObjectCommand({ Bucket: storage.bucket, Key: key }))
        .catch(() => undefined);
  }

  private storage(): {
    endpoint: string;
    region: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
  } {
    const value = (name: string): string => {
      const found = this.config?.get<string>(name)?.trim();
      if (!found) throw new ServiceUnavailableException("Product media storage is not configured.");
      return found;
    };
    const endpoint = value("PRODUCT_MEDIA_ENDPOINT");
    const bucket = value("PRODUCT_MEDIA_BUCKET");
    let parsedEndpoint: URL;
    try {
      parsedEndpoint = new URL(endpoint);
    } catch {
      throw new ServiceUnavailableException("Product media storage is not configured correctly.");
    }
    if (
      !["http:", "https:"].includes(parsedEndpoint.protocol) ||
      bucket.toLowerCase().includes("private")
    )
      throw new ServiceUnavailableException("Product media storage is not configured correctly.");
    return {
      endpoint,
      region: this.config?.get<string>("PRODUCT_MEDIA_REGION")?.trim() || "us-east-1",
      bucket,
      accessKeyId: value("PRODUCT_MEDIA_ACCESS_KEY_ID"),
      secretAccessKey: value("PRODUCT_MEDIA_SECRET_ACCESS_KEY"),
    };
  }

  private client(storage: ReturnType<MediaService["storage"]>): S3Client {
    return new S3Client({
      endpoint: storage.endpoint,
      region: storage.region,
      forcePathStyle: true,
      credentials: { accessKeyId: storage.accessKeyId, secretAccessKey: storage.secretAccessKey },
    });
  }
}
