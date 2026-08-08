import { ContentEntityType } from "../../common/content/content-entity-type";
import { PrismaService } from "../../prisma/prisma.service";

import { MediaService } from "./media.service";

const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";

type Stubs = {
  service: MediaService;
  mediaFindMany: jest.Mock;
};

/** No database is reached — only the delegate method this service calls is stubbed. */
function createService(): Stubs {
  const mediaFindMany = jest.fn().mockResolvedValue([]);

  const prisma = {
    media: { findMany: mediaFindMany },
  } as unknown as PrismaService;

  return { service: new MediaService(prisma), mediaFindMany };
}

describe("MediaService.findImagesForOwner", () => {
  // Moved here from products.service.spec.ts with the query itself. COA, SDS, TDS and every
  // other document are `file`/`document` rows. The type filter is what keeps them out —
  // `media` has no visibility column to forget to set.
  it("asks for image media owned by the named entity only", async () => {
    const { service, mediaFindMany } = createService();

    await service.findImagesForOwner(ContentEntityType.Product, PRODUCT_ID);

    expect(mediaFindMany).toHaveBeenCalledWith({
      // "IMAGE" is the Prisma enum member; PostgreSQL stores it as the mapped label `image`.
      where: { ownerType: "Product", ownerId: PRODUCT_ID, type: "IMAGE" },
      orderBy: { id: "asc" },
      select: { id: true, url: true, altText: true },
    });
  });

  // `media` is polymorphic and holds CVs and confidential formulation specifications next to
  // product imagery (RAG_IMPLEMENTATION_ARCHITECTURE.md §4). A caller's owner type reaching
  // the query unchanged is what makes the allow-list hold; a defaulted or ignored one is how
  // a module ends up reading rows it never named.
  it("passes the caller's owner type through rather than defaulting to Product", async () => {
    const { service, mediaFindMany } = createService();

    await service.findImagesForOwner(ContentEntityType.BlogPost, PRODUCT_ID);

    const call = mediaFindMany.mock.calls[0]?.[0] as { where: { ownerType: string } };

    expect(call.where.ownerType).toBe("BlogPost");
  });

  it("returns the rows verbatim", async () => {
    const { service, mediaFindMany } = createService();

    mediaFindMany.mockResolvedValue([
      { id: "media-1", url: "/img/sn-500.webp", altText: "SN 500" },
    ]);

    await expect(
      service.findImagesForOwner(ContentEntityType.Product, PRODUCT_ID),
    ).resolves.toEqual([{ id: "media-1", url: "/img/sn-500.webp", altText: "SN 500" }]);
  });

  it("returns an empty array for an entity that owns no imagery", async () => {
    const { service } = createService();

    await expect(
      service.findImagesForOwner(ContentEntityType.Product, PRODUCT_ID),
    ).resolves.toEqual([]);
  });
});
