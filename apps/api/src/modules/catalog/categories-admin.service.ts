import { Injectable, NotFoundException } from "@nestjs/common";

import { ContentEntityType } from "../../common/content/content-entity-type";
import { PrismaService } from "../../prisma/prisma.service";
import { MediaService } from "../media/media.service";

export type CategoryAdminListItem = {
  id: string;
  name: string;
  slug: string;
  processImage: { id: string; url: string; altText: string | null } | null;
};

/**
 * Admin management of the six Product Family `Category` rows' process photograph — the image
 * `category-template-v2.tsx`'s `ProcessMedia` block renders, or its labelled placeholder when
 * this returns `null`. Nothing else about `Category` (name, slug, hierarchy) is editable here;
 * those stay owned by `prisma/seed-categories.ts`, unchanged by this gate.
 */
@Injectable()
export class CategoriesAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
  ) {}

  async list(): Promise<CategoryAdminListItem[]> {
    const categories = await this.prisma.category.findMany({
      where: { parentId: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true },
    });

    return Promise.all(
      categories.map(async (category) => {
        const images = await this.media.findImagesForOwner(ContentEntityType.Category, category.id);
        const image = images[0] ?? null;
        return {
          ...category,
          processImage: image ? { id: image.id, url: image.url, altText: image.altText } : null,
        };
      }),
    );
  }

  /**
   * A Category takes exactly one process image, never a gallery: any existing row is deleted
   * first, so the upload that follows is a replace rather than an addition. Deleting before
   * uploading — rather than uploading then pruning — means a failed upload leaves the category
   * with no image rather than briefly with two.
   */
  async uploadImage(
    id: string,
    file: { buffer: Buffer; mimetype: string; originalname: string; size: number },
    altText: string,
    actorId: string,
  ): Promise<Record<string, unknown>> {
    await this.assertCategory(id);
    const existing = await this.media.findImagesForOwner(ContentEntityType.Category, id);
    for (const image of existing) {
      await this.media.deleteCategoryImage(id, image.id, actorId);
    }
    return this.media.uploadCategoryImage(id, file, altText, actorId);
  }

  async deleteImage(id: string, imageId: string, actorId: string): Promise<void> {
    await this.assertCategory(id);
    await this.media.deleteCategoryImage(id, imageId, actorId);
  }

  private async assertCategory(id: string): Promise<void> {
    if (!(await this.prisma.category.findUnique({ where: { id }, select: { id: true } })))
      throw new NotFoundException("Category not found.");
  }
}
