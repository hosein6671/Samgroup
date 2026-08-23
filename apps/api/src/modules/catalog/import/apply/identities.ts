/**
 * Deterministic database identities for every row the catalog import writes.
 *
 * ── Why the ids are derived rather than generated ───────────────────────────
 *
 * A rerun must converge on the rows it wrote last time. Random uuids cannot: the second run
 * would insert a second copy of everything and the database would accept it. Deriving each id
 * from the row's STABLE IDENTITY makes `ON CONFLICT DO NOTHING` a no-op on replay, and makes
 * the plan's output a pure function of its input.
 *
 * ── Derived ids are a convenience, not the guarantee ────────────────────────
 *
 * The guarantee lives in the database: `products.source_ref`, the three import-identity
 * unique indexes, and the natural keys that already existed. Those reject a duplicate even
 * when it arrives with a different id — from a code change, a partial run, or a second
 * writer. These ids let the importer converge; the constraints make convergence enforceable.
 * Neither substitutes for the other, and the ids are never the only thing standing between
 * the catalogue and a duplicate row.
 *
 * ── What is never used as identity ──────────────────────────────────────────
 *
 * Array position, display name, worksheet row, insertion order, or a clock. A ratified
 * `sourceRef` is OPAQUE (ADR-011, PRODUCT-DATA-2C-A) and is used verbatim as an opaque
 * string — never parsed, never re-derived from the row it currently sits on.
 */

import { createHash } from "node:crypto";

/**
 * UUIDv5 (RFC 4122 §4.3), implemented here rather than added as a dependency.
 *
 * SHA-1 is used for the name hash because the version-5 layout specifies it. It is a naming
 * scheme, not a security primitive: these ids are not secrets, are not tokens, and nothing
 * authenticates on them. Collision resistance is what matters, and for the fixed, structured
 * key space below it is not in question.
 */
function uuidV5(namespace: string, name: string): string {
  const hex = namespace.replace(/-/g, "");
  const namespaceBytes = Buffer.from(hex, "hex");
  if (namespaceBytes.length !== 16) throw new Error(`Not a uuid namespace: ${namespace}`);

  const digest = createHash("sha1")
    .update(Buffer.concat([namespaceBytes, Buffer.from(name, "utf8")]))
    .digest();

  const bytes = Buffer.from(digest.subarray(0, 16));
  // Version 5, RFC 4122 variant.
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

  const s = bytes.toString("hex");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

/**
 * The importer's own uuid namespace. A fixed constant: changing it re-mints every id in the
 * catalogue, so it is frozen and must never be "refreshed".
 */
export const CATALOG_IMPORT_NAMESPACE = "6f1d5b2e-8a34-5c77-9f0e-1c2d3e4f5a6b";

/** Joined with a delimiter that cannot occur in any component, so keys cannot collide. */
const DELIMITER = "\u0000";

function key(kind: string, ...parts: readonly (string | number | null)[]): string {
  return [kind, ...parts.map((part) => (part === null ? "" : String(part)))].join(DELIMITER);
}

const derive = (kind: string, ...parts: readonly (string | number | null)[]): string =>
  uuidV5(CATALOG_IMPORT_NAMESPACE, key(kind, ...parts));

/** A Product is its ratified identity. Nothing else about the row participates. */
export const productId = (sourceRef: string): string => derive("product", sourceRef);

/** A grade is the verbatim source label, within its product. */
export const productGradeId = (sourceRef: string, label: string): string =>
  derive("product-grade", sourceRef, label);

/** A ProductType is its slug — the approved vocabulary key. */
export const productTypeId = (slug: string): string => derive("product-type", slug);

/** An asset IS its content hash; the database already treats `sha256` as unique. */
export const sourceAssetId = (sha256: string): string => derive("source-asset", sha256);

/** A document is a locator plus the revision of the file behind it (ADR-014 §6). */
export const sourceDocumentId = (
  locatorType: string,
  locatorValue: string,
  assetSha256: string | null,
): string => derive("source-document", locatorType, locatorValue, assetSha256);

/**
 * A fact is its verbatim reading, at its place in a document. Deliberately EXCLUDES the
 * import run: an unchanged reading re-read by a later run is the same fact, and a changed
 * reading differs here and correctly becomes a new one.
 */
export const sourceFactId = (evidenceIdentity: string): string =>
  derive("source-fact", evidenceIdentity);

/** One normalized value per subject and property, matching the database's unique index. */
export const specificationId = (
  sourceRef: string,
  gradeLabel: string | null,
  propertyKey: string,
): string => derive("specification", sourceRef, gradeLabel, propertyKey);

/**
 * A claim is its normalized statement plus the reading it came from — the same tuple the
 * database's unique index uses, because two claims that the columns cannot tell apart are
 * two claims a replay cannot tell apart either.
 */
export const productClaimId = (
  sourceRef: string,
  gradeLabel: string | null,
  kind: string,
  standardBody: string | null,
  standardCode: string | null,
  claimIdentityHash: string,
): string =>
  derive(
    "product-claim",
    sourceRef,
    gradeLabel,
    kind,
    standardBody,
    standardCode,
    claimIdentityHash,
  );

/**
 * The comparison form of a claim STATEMENT. Folds the differences that are typography rather
 * than meaning — compatibility characters, double spaces, casing — so the same sentence
 * re-typed or re-exported still identifies the same claim.
 */
function normalizeStatement(text: string): string {
  return text.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * The discriminator stored in `product_claims.claim_identity_hash`: the SHA-256 of the
 * NORMALIZED STATEMENT the claim was read from.
 *
 * ── Why the statement and not the reading ───────────────────────────────────
 *
 * It exists because the normalized columns cannot separate two real claims: three products
 * state two different suitabilities that both reduce to `SUITABLE_FOR` with a NULL body, code
 * and note, and only the sentence tells them apart.
 *
 * It hashes the SENTENCE, not the reading's location. An earlier version hashed the
 * SourceFact evidence identity, which includes the page number — so re-issuing a supplier
 * catalogue and moving an identical sentence from page 33 to page 35 produced a SECOND ACTIVE
 * CLAIM for a statement that never changed. A claim's identity is what it SAYS; where it was
 * found is evidence, and evidence has its own identity and its own revisions.
 *
 * Excluded on purpose: page, row and column (mutable worksheet position), the public product
 * name, and anything that changes when a document is re-issued. Included: nothing but the
 * statement, because `productClaimId` already carries the product, grade, kind, body and code.
 *
 * A HASH, so no verbatim third-party sentence is stored in a column. It is an IDENTITY, never
 * an evidence link — `ClaimEvidence` remains the only record of which facts support a claim,
 * and a newer revision of the same sentence attaches there as another link rather than
 * creating a second claim.
 */
export const claimIdentityHash = (statementText: string): string =>
  createHash("sha256").update(normalizeStatement(statementText), "utf8").digest("hex");

/**
 * A `spec_property_mappings` row is its `(rawProperty, rawUnit)` pair — exactly the tuple
 * `spec_property_mappings_raw_property_raw_unit_key` indexes.
 *
 * A uuid, derived through the same namespace as every other id here. An earlier version handed
 * `identityKey` straight to the `id` column, which is a NUL-delimited key string and not a
 * uuid at all; nothing caught it because nothing had ever persisted a mapping.
 */
export const specPropertyMappingId = (rawProperty: string, rawUnit: string | null): string =>
  derive("spec-property-mapping", rawProperty, rawUnit);

/**
 * An ImportRun is THE SUCCESSFUL APPLICATION OF ONE MANIFEST, so its id is the manifest hash
 * and nothing else — not the clock, not the operator, not the attempt.
 *
 * `import_runs_applied_manifest_key` already forbids two FINISHED runs for one manifest; this
 * makes a retried attempt converge on the same row rather than accumulating orphan runs no
 * fact cites. A rolled-back attempt leaves nothing behind at all, so the id is free again by
 * construction.
 */
export const importRunId = (manifestHash: string): string => derive("import-run", manifestHash);

/** Exported for tests that assert the key space rather than the hash. */
export const identityKey = key;
