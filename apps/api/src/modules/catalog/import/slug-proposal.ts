/**
 * Proposes the `/{locale}/products/{slug}` segment for each authoritative row, and checks
 * it against the ADR-011 namespace before anything is planned.
 *
 * ── Ratified slugs ──────────────────────────────────────────────────────────
 *
 * The workbook contains two duplicate NAME groups — `SN Grade` at rows 69 and 96, and
 * `SG Grade` at rows 81 and 99 — which are four distinct products, not two. The
 * discriminator comes from the source: `نوع محصول` separates gasoline from motorcycle,
 * and the HSB catalogue numbers them as separate entries in separate sections. Four
 * semantic slugs are ratified for them.
 *
 * They are the ONLY exception. Every other slug is derived from the exact Excel name, and
 * a collision is REPORTED rather than resolved — a numeric suffix would invent an
 * identity the sources do not support and would silently make two products look like
 * revisions of one.
 *
 * ── Names are not changed to make slugs work ────────────────────────────────
 *
 * The display name stays exactly what the workbook says. A URL discriminator is a
 * routing decision; it is not a rename, and the four ratified slugs do not alter
 * `SN Grade` or `SG Grade` as printed anywhere a buyer sees them.
 *
 * ── Grades take no part in this ─────────────────────────────────────────────
 *
 * Four Products are NAMED after viscosity grades (`ISO VG 32`, `46`, `68`, `100`), and the
 * same four strings are grade LABELS under other products. That is harmless only because
 * `ProductGrade` has no slug and never enters this namespace. If it ever did, four products
 * would claim `iso-vg-32` and ADR-011 INV-1 would reject three of them.
 */

/** Reserved segments of the products namespace (ADR-011 INV-2). Nothing may normalize to these. */
export const RESERVED_SLUGS: readonly string[] = ["finder", "segments", "types"];

/** The four slugs ratified by the Architect, keyed by workbook row. */
export const RATIFIED_SLUGS: ReadonlyMap<number, string> = new Map([
  [69, "sn-grade-gasoline"],
  [96, "sn-grade-motorcycle"],
  [81, "sg-grade-gasoline"],
  [99, "sg-grade-motorcycle"],
]);

/**
 * The database's `slug_key()` in TypeScript: `lower(normalize(value, NFC))`. Used to test a
 * proposal against the namespace BEFORE any write, exactly as ADR-011 requires. It is a
 * check, never the enforcement — the enforcement is the trigger set, and application
 * validation exists here only so a rejection carries a useful message.
 */
export function slugKey(value: string): string {
  return value.normalize("NFC").toLowerCase();
}

/**
 * Derives a slug from an exact product name.
 *
 * NFKD then stripping combining marks folds accented Latin to ASCII; every remaining run of
 * non-alphanumerics becomes a single hyphen. Deterministic, and identical for a given name
 * on every run — which is what makes the manifest hash stable.
 */
export function slugifyProductName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export interface SlugProposal {
  readonly slug: string;
  readonly isRatified: boolean;
}

export function proposeSlug(rowNumber: number, name: string): SlugProposal {
  const ratified = RATIFIED_SLUGS.get(rowNumber);
  if (ratified) return { slug: ratified, isRatified: true };
  return { slug: slugifyProductName(name), isRatified: false };
}

export type SlugIssueCode =
  "SLUG_EMPTY" | "SLUG_RESERVED" | "SLUG_COLLISION_WITHIN_IMPORT" | "SLUG_COLLISION_WITH_EXISTING";

export interface SlugIssue {
  readonly code: SlugIssueCode;
  readonly slug: string;
  /** Workbook rows involved. A within-import collision names every row that claims the key. */
  readonly rows: readonly number[];
  readonly detail: string;
}

export interface SlugCheckInput {
  readonly rowNumber: number;
  readonly slug: string;
  /**
   * The ratified identity this row resolved to, when it has one. Used only to recognise a
   * claim this very row already owns; it is never used to derive or validate the slug.
   */
  readonly sourceRef?: string | null;
}

/**
 * Validates the whole set of proposals at once, because a collision is a property of the
 * set rather than of any one row. `existingSlugKeys` is the live `product_slug_claims`
 * content — categories included, since ADR-010 makes the namespace their union.
 */
export function checkSlugNamespace(
  proposals: readonly SlugCheckInput[],
  existingSlugKeys: ReadonlySet<string>,
  existingSlugKeyOwners?: ReadonlyMap<string, string | null>,
): SlugIssue[] {
  const issues: SlugIssue[] = [];
  const byKey = new Map<string, number[]>();
  const refByRow = new Map(
    proposals.flatMap((proposal) =>
      proposal.sourceRef === undefined || proposal.sourceRef === null
        ? []
        : [[proposal.rowNumber, proposal.sourceRef] as const],
    ),
  );

  /**
   * Whether the claim on `key` is already held BY THE VERY ROW proposing it.
   *
   * A re-run of an import that already succeeded finds all 100 of its own slugs sitting in
   * `product_slug_claims`, owned by the Products it wrote. Reporting those as collisions
   * would make an identical replay indistinguishable from a hundred genuine namespace
   * conflicts, which is the opposite of what ADR-010 wants the check to say.
   *
   * The owner map is keyed by slug key and carries the OWNING Product's ratified
   * `source_ref` — null for a Category, a translated slug, or a Product with no identity, so
   * none of those can ever be mistaken for self-ownership. Absent entirely (the default), the
   * check behaves exactly as it did before: every existing key is a collision.
   */
  const ownedByProposer = (key: string, rows: readonly number[]): boolean => {
    if (existingSlugKeyOwners === undefined) return false;
    const owner = existingSlugKeyOwners.get(key);
    if (owner === undefined || owner === null) return false;
    return rows.length === 1 && refByRow.get(rows[0] ?? -1) === owner;
  };

  for (const proposal of proposals) {
    const key = slugKey(proposal.slug);
    if (proposal.slug.length === 0) {
      issues.push({
        code: "SLUG_EMPTY",
        slug: proposal.slug,
        rows: [proposal.rowNumber],
        detail: "The product name produced an empty slug; it needs an explicit ratified slug.",
      });
      continue;
    }
    if (RESERVED_SLUGS.includes(key)) {
      issues.push({
        code: "SLUG_RESERVED",
        slug: proposal.slug,
        rows: [proposal.rowNumber],
        detail: `"${key}" is reserved in the products namespace by ADR-011 INV-2.`,
      });
    }
    const bucket = byKey.get(key);
    if (bucket) bucket.push(proposal.rowNumber);
    else byKey.set(key, [proposal.rowNumber]);
  }

  for (const [key, rows] of byKey) {
    if (rows.length > 1) {
      issues.push({
        code: "SLUG_COLLISION_WITHIN_IMPORT",
        slug: key,
        rows,
        detail:
          `${rows.length} workbook rows normalize to the same slug key. ` +
          `No suffix is added; the owner must ratify a distinguishing slug.`,
      });
    }
    if (existingSlugKeys.has(key) && !ownedByProposer(key, rows)) {
      issues.push({
        code: "SLUG_COLLISION_WITH_EXISTING",
        slug: key,
        rows,
        detail: `"${key}" is already claimed in product_slug_claims by an existing entity.`,
      });
    }
  }

  return issues.sort((a, b) => a.slug.localeCompare(b.slug) || a.code.localeCompare(b.code));
}
