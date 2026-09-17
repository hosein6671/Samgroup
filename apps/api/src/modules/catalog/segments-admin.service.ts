import { ConflictException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { SegmentCreate } from "./segments-admin.dto";

/** ADR-008 §2: `Other` is vocabulary, never a persisted Segment. Re-affirmed here, not reopened. */
const FORBIDDEN_SLUG = "other";

export interface SegmentListItem {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly sortOrder: number;
  readonly productCount: number;
}

/**
 * Derives a Segment slug from an admin-entered name — ASCII-folded, lower-cased, hyphenated.
 *
 * The same transform `slugifyProductName` (`catalog/import/slug-proposal.ts`) already applies to
 * Product names, kept as its own small copy rather than a shared import: `Segment.slug` is not
 * part of the ADR-011 products-slug-claim namespace (ADR-008 §1 — "`Segment.slug` and
 * `Category.slug` are unique on separate tables, so the two axes share no uniqueness surface at
 * all"), so borrowing the Products module's function would imply a shared namespace that does not
 * exist.
 */
function slugifyName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * ADR-026: Admin-only create-and-list for the Segment taxonomy, closing ADR-008 §7's
 * Admin/API-writes deferral. `prisma/seed-catalog.ts` remains the mechanism for the eight
 * ADR-008-approved rows; this is the second, admin-facing path for rows beyond those eight, and
 * the two do not conflict because both key on the same unique `slug` column.
 */
@Injectable()
export class SegmentsAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<SegmentListItem[]> {
    const rows = await this.prisma.segment.findMany({
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        sortOrder: true,
        _count: { select: { products: true } },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      sortOrder: row.sortOrder,
      productCount: row._count.products,
    }));
  }

  async create(actorId: string, input: SegmentCreate): Promise<SegmentListItem> {
    const name = input.name.trim();
    const slug = slugifyName(name);
    if (!slug)
      throw new ConflictException(
        "That name does not produce a usable URL slug. Try adding a letter or number.",
      );
    if (slug === FORBIDDEN_SLUG)
      throw new ConflictException(
        '"Other" is not a Segment — products with no real Segment simply have none assigned.',
      );
    try {
      return await this.prisma.$transaction(async (tx) => {
        const last = await tx.segment.aggregate({ _max: { sortOrder: true } });
        const segment = await tx.segment.create({
          data: { name, slug, sortOrder: (last._max.sortOrder ?? 0) + 1 },
          select: { id: true, name: true, slug: true, sortOrder: true },
        });
        await this.audit.append(
          { event: "segment.created", actorId, subjectId: segment.id, outcome: "success" },
          tx,
        );
        return { ...segment, productCount: 0 };
      });
    } catch (error: unknown) {
      if (error && typeof error === "object" && "code" in error && error.code === "P2002")
        throw new ConflictException(`A Segment with the slug "${slug}" already exists.`);
      throw error;
    }
  }
}
