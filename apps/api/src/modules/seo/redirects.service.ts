import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../prisma/prisma.service";

import type { RedirectResponse } from "./dto/redirect.response";

/**
 * The `redirects` table's public read. Separate from SeoService because the two answer
 * different questions: SeoService describes ONE entity's metadata, while this describes the
 * whole site's routing rules and is not scoped to an entity at all.
 *
 * `Redirect` is flat and non-polymorphic by design (schema.prisma) — it operates on paths,
 * so a rule survives deletion of whatever entity once lived at that path. Nothing here
 * resolves a rule against a content record.
 */
@Injectable()
export class RedirectsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Every active rule, in one response.
   *
   * Deliberately unfiltered by locale, unlike every content-bearing endpoint
   * (API_CONTRACT_FINAL.md §3). Middleware evaluates an incoming path BEFORE it knows which
   * entity or locale the request will resolve to, and it needs the global (`locale: null`)
   * rules alongside the locale-specific ones to do that. A `?locale=` filter would hand the
   * frontend a partial rule set and produce dead links for exactly the rules it dropped.
   */
  findActive(): Promise<RedirectResponse[]> {
    return this.prisma.redirect.findMany({
      where: { isActive: true },
      // The table has no natural ordering column, and middleware builds a lookup rather than
      // reading in order — this exists so two requests return the same list in the same
      // order, which is what makes the response cacheable and diffable later.
      orderBy: [{ fromPath: "asc" }, { locale: "asc" }],
      select: { fromPath: true, toPath: true, statusCode: true, locale: true },
    });
  }
}
