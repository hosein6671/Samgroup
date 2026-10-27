/**
 * `pnpm catalog:content:import` — the guarded bulk path for product editorial content (ADR-027 §5).
 *
 * This file holds everything that can be decided without a database connection — argument
 * parsing, file validation with the editor's own DTOs, the per-product plan and the report — and
 * the apply loop, which only ever writes through the two editor services. It constructs no
 * PrismaClient: `content-import.run.ts` is the executable and the only place one is opened.
 *
 * What it never touches: names, slugs, specifications, claims, grades, provenance or review state.
 * A product's name is checked against the file and refused on mismatch, never rewritten.
 */
import { createHash } from "node:crypto";

import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { ProductEditorialContent } from "../../product-editor.dto";
import { productEditorialSections } from "../../product-editorial-sections";

import type { ProductEditorialEdit } from "../../product-editor.dto";
import type { ProductEditorialSections } from "@sam-group/types";

export const IMPORT_ENABLE_ENV = "SAM_ALLOW_PRODUCT_CONTENT_IMPORT";
export const IMPORT_TARGET_DATABASE = "sam_platform";

const PLACEHOLDER_MARKER = /\[(TO CONFIRM|ESTIMATE)/i;
const TRANSLATION_STATUSES = ["machine_draft", "human_reviewed"] as const;
type WireTranslationStatus = (typeof TRANSLATION_STATUSES)[number];

/** The SEO fields the editor stores; mirrors SeoService's EditableSeo. */
export type EditableSeoShape = {
  metaTitle: string;
  metaDescription: string;
  canonicalUrl?: string;
  ogTitle: string;
  ogDescription: string;
  twitterTitle: string;
  twitterDescription: string;
  twitterCardType: "summary" | "summary_large_image";
  robotsIndex: boolean;
  robotsFollow: boolean;
  keywords: string[];
};

// ── Arguments ────────────────────────────────────────────────────────────────

export type ImportArgs = {
  file: string;
  apply: boolean;
  confirmTarget?: string;
  expectSha256?: string;
  replace: Set<string>;
  locales?: Set<string>;
  operator?: string;
};

export function parseArgs(argv: readonly string[]): ImportArgs | { error: string } {
  const args: ImportArgs = { file: "", apply: false, replace: new Set() };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = (): string | undefined => {
      const next = argv[index + 1];
      if (next === undefined || next.startsWith("--")) return undefined;
      index += 1;
      return next;
    };
    switch (flag) {
      case "--file": {
        const file = value();
        if (!file) return { error: "--file needs a path." };
        args.file = file;
        break;
      }
      case "--apply":
        args.apply = true;
        break;
      case "--dry-run":
        break;
      case "--confirm-target": {
        const target = value();
        if (!target) return { error: "--confirm-target needs a database name." };
        args.confirmTarget = target;
        break;
      }
      case "--expect-sha256": {
        const hash = value();
        if (!hash || !/^[0-9a-f]{64}$/.test(hash))
          return { error: "--expect-sha256 needs a 64-character lowercase hex digest." };
        args.expectSha256 = hash;
        break;
      }
      case "--replace": {
        const slug = value();
        if (!slug) return { error: "--replace needs one product slug." };
        args.replace.add(slug);
        break;
      }
      case "--locale": {
        const locale = value();
        if (!locale) return { error: "--locale needs a locale code." };
        (args.locales ??= new Set()).add(locale);
        break;
      }
      case "--operator": {
        const operator = value();
        if (!operator) return { error: "--operator needs a label." };
        args.operator = operator;
        break;
      }
      default:
        return { error: `Unknown argument: ${String(flag)}` };
    }
  }
  if (!args.file) return { error: "--file is required." };
  return args;
}

/** Every precondition `--apply` adds on top of a clean dry run. Empty means authorized. */
export function applyAuthorizationErrors(
  args: ImportArgs,
  env: Record<string, string | undefined>,
  fileSha256: string,
  currentDatabase: string,
): string[] {
  if (!args.apply) return [];
  const errors: string[] = [];
  if (env[IMPORT_ENABLE_ENV] !== "true") errors.push(`${IMPORT_ENABLE_ENV}=true is not set.`);
  if (args.confirmTarget !== IMPORT_TARGET_DATABASE)
    errors.push(`--confirm-target ${IMPORT_TARGET_DATABASE} is required.`);
  if (currentDatabase !== IMPORT_TARGET_DATABASE)
    errors.push(
      `Connected to "${currentDatabase}", but this import writes only to "${IMPORT_TARGET_DATABASE}".`,
    );
  if (!args.expectSha256) errors.push("--expect-sha256 is required.");
  else if (args.expectSha256 !== fileSha256)
    errors.push(`--expect-sha256 does not match the file (file is ${fileSha256}).`);
  if (!args.operator)
    errors.push("--operator <label> is required, so the report names who ran it.");
  return errors;
}

export function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

// ── File validation ──────────────────────────────────────────────────────────

export type LocaleBlock = {
  description: string;
  sections: ProductEditorialSections;
  seo: Partial<EditableSeoShape> & {
    robotsIndex: boolean;
    robotsFollow: boolean;
    keywords: string[];
  };
  translationStatus: WireTranslationStatus;
};

export type ImportEntry = {
  slug: string;
  sourceRef: string;
  name: string;
  locales: Map<string, LocaleBlock>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function placeholderPaths(value: unknown, path: string): string[] {
  if (typeof value === "string") return PLACEHOLDER_MARKER.test(value) ? [path] : [];
  if (Array.isArray(value))
    return value.flatMap((item, index) => placeholderPaths(item, `${path}[${index}]`));
  if (isRecord(value))
    return Object.entries(value).flatMap(([key, item]) => placeholderPaths(item, `${path}.${key}`));
  return [];
}

function constraintMessages(errors: Awaited<ReturnType<typeof validate>>, path: string): string[] {
  return errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}).map(
      (message) => `${path}.${error.property}: ${message}`,
    ),
    ...constraintMessages(error.children ?? [], `${path}.${error.property}`),
  ]);
}

/**
 * Validates the whole file before any connection opens. Every locale block goes through
 * `ProductEditorialContent` — the DTO the editor's PATCH is validated with — under the same
 * whitelist rules as the HTTP pipe, so the file cannot carry anything the editor would refuse.
 */
export async function validateContentFile(
  raw: unknown,
): Promise<{ entries: ImportEntry[]; errors: string[] }> {
  const errors: string[] = [];
  const entries: ImportEntry[] = [];
  if (!isRecord(raw) || raw["schemaVersion"] !== 1 || !Array.isArray(raw["products"]))
    return { entries, errors: ["The file is not a schemaVersion 1 product content file."] };

  errors.push(
    ...placeholderPaths(raw["products"], "products").map((p) => `${p}: placeholder marker`),
  );

  const seen = new Set<string>();
  for (const [index, product] of (raw["products"] as unknown[]).entries()) {
    const path = `products[${index}]`;
    if (
      !isRecord(product) ||
      typeof product["slug"] !== "string" ||
      typeof product["sourceRef"] !== "string" ||
      typeof product["name"] !== "string" ||
      !isRecord(product["locales"])
    ) {
      errors.push(`${path}: needs slug, sourceRef, name and locales.`);
      continue;
    }
    const slug = product["slug"];
    if (seen.has(slug)) errors.push(`${path}: duplicate slug ${slug}.`);
    seen.add(slug);
    const locales = new Map<string, LocaleBlock>();
    for (const [locale, block] of Object.entries(product["locales"])) {
      const blockPath = `${path}.locales.${locale}`;
      if (!isRecord(block)) {
        errors.push(`${blockPath}: not an object.`);
        continue;
      }
      const { translationStatus, ...content } = block;
      if (!TRANSLATION_STATUSES.includes(translationStatus as WireTranslationStatus)) {
        errors.push(`${blockPath}.translationStatus: must be machine_draft or human_reviewed.`);
        continue;
      }
      const dto = plainToInstance(ProductEditorialContent, { ...content, name: product["name"] });
      const failures = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
      if (failures.length > 0) {
        errors.push(...constraintMessages(failures, blockPath));
        continue;
      }
      locales.set(locale, {
        description: dto.description,
        sections: productEditorialSections(dto),
        seo: { ...dto.seo },
        translationStatus: translationStatus as WireTranslationStatus,
      });
    }
    entries.push({ slug, sourceRef: product["sourceRef"], name: product["name"], locales });
  }
  return { entries, errors };
}

// ── Plan ─────────────────────────────────────────────────────────────────────

/** What the database holds for one product in one locale, read before the plan is made. */
export type PublishedState = {
  revision: number;
  /** Null when this locale has never been published through the editor. */
  publishedSections: ProductEditorialSections | null;
  description: string;
  seo: EditableSeoShape;
  /** Non-default locales only. */
  translationStatus?: WireTranslationStatus;
};

export type ProductState = {
  id: string;
  name: string;
  sourceRef: string | null;
  locales: Map<string, PublishedState>;
};

export type ImportDatabase = {
  currentDatabase(): Promise<string>;
  /** Active locales, and which one is the default. */
  locales(): Promise<{ codes: string[]; defaultCode: string }>;
  /** Null when no product has this slug. */
  readProduct(slug: string, locales: readonly string[]): Promise<ProductState | null>;
};

export type PlanAction = "create" | "noop" | "replace" | "refused" | "error";

export type PlanItem = {
  slug: string;
  locale: string;
  action: PlanAction;
  reason?: string;
  productId?: string;
  revision?: number;
  edit?: ProductEditorialEdit;
};

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (isRecord(value))
    return `{${Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stable(value[key])}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

/** The file's SEO laid over what is stored, so fields the file does not carry are kept. */
export function mergeSeo(
  current: EditableSeoShape,
  incoming: LocaleBlock["seo"],
): EditableSeoShape {
  const merged: EditableSeoShape = { ...current };
  for (const [key, value] of Object.entries(incoming)) {
    if (value !== undefined) (merged as Record<string, unknown>)[key] = value;
  }
  return merged;
}

/**
 * True when no editorial content of this locale exists to overwrite: the editor has never
 * published it (a description that came with the catalogue import is base data, not editorial),
 * or it was published empty — empty description and empty sections, an editor saving the empty
 * form. Either way this is a first publication, not a replacement. SEO is not considered: the
 * import keeps every stored SEO field the file does not carry.
 */
export function hasNoPublishedText(state: PublishedState): boolean {
  const sections = state.publishedSections;
  if (sections === null) return true;
  return (
    state.description.trim() === "" &&
    sections.applications.length === 0 &&
    sections.features.length === 0 &&
    sections.faq.length === 0
  );
}

export async function planImport(
  entries: readonly ImportEntry[],
  database: ImportDatabase,
  options: { replace: ReadonlySet<string>; locales?: ReadonlySet<string> },
): Promise<PlanItem[]> {
  const { codes, defaultCode } = await database.locales();
  const items: PlanItem[] = [];
  for (const entry of entries) {
    const wanted = [...entry.locales.keys()].filter(
      (locale) => !options.locales || options.locales.has(locale),
    );
    if (wanted.length === 0) continue;
    const unknown = wanted.filter((locale) => !codes.includes(locale));
    const product = await database.readProduct(
      entry.slug,
      wanted.filter((locale) => codes.includes(locale)),
    );
    const identityError =
      product === null
        ? "no product has this slug"
        : product.sourceRef !== entry.sourceRef
          ? `sourceRef ${entry.sourceRef} does not match the product's ${String(product.sourceRef)}`
          : product.name !== entry.name
            ? `name "${entry.name}" does not match the product's "${product.name}"`
            : null;
    for (const locale of wanted) {
      if (unknown.includes(locale)) {
        items.push({ slug: entry.slug, locale, action: "error", reason: "locale is not active" });
        continue;
      }
      if (identityError !== null || product === null) {
        items.push({ slug: entry.slug, locale, action: "error", reason: identityError ?? "" });
        continue;
      }
      const block = entry.locales.get(locale);
      const state = product.locales.get(locale);
      if (!block || !state) {
        items.push({ slug: entry.slug, locale, action: "error", reason: "state unreadable" });
        continue;
      }
      const seo = mergeSeo(state.seo, block.seo);
      const isDefault = locale === defaultCode;
      const target = {
        description: block.description,
        sections: block.sections,
        seo,
        ...(isDefault ? {} : { translationStatus: block.translationStatus }),
      };
      const published = {
        description: state.description,
        sections: state.publishedSections,
        seo: state.seo,
        ...(isDefault ? {} : { translationStatus: state.translationStatus }),
      };
      const edit: ProductEditorialEdit = {
        revision: state.revision,
        action: "publish",
        ...(isDefault ? {} : { translationStatus: block.translationStatus }),
        content: {
          name: product.name,
          description: block.description,
          ...block.sections,
          seo,
        } as ProductEditorialEdit["content"],
      };
      const base = { slug: entry.slug, locale, productId: product.id, revision: state.revision };
      if (stable(target) === stable(published)) items.push({ ...base, action: "noop" });
      else if (hasNoPublishedText(state)) items.push({ ...base, action: "create", edit });
      else if (options.replace.has(entry.slug)) items.push({ ...base, action: "replace", edit });
      else
        items.push({
          ...base,
          action: "refused",
          reason: "published content differs; pass --replace <slug> to overwrite",
        });
    }
  }
  return items;
}

// ── Apply ────────────────────────────────────────────────────────────────────

export type PublishFn = (
  item: PlanItem & { edit: ProductEditorialEdit; productId: string },
) => Promise<void>;

/**
 * Writes every create/replace item through the editor services, one product-locale per
 * SERIALIZABLE transaction (the services own the transaction). Nothing is written when any
 * item is refused or in error: a partial bulk import is harder to reason about than none.
 */
export async function applyPlan(
  items: readonly PlanItem[],
  publish: PublishFn,
): Promise<{ written: number; blocked: boolean }> {
  if (items.some((item) => item.action === "refused" || item.action === "error"))
    return { written: 0, blocked: true };
  let written = 0;
  for (const item of items) {
    if ((item.action === "create" || item.action === "replace") && item.edit && item.productId) {
      await publish({ ...item, edit: item.edit, productId: item.productId });
      written += 1;
    }
  }
  return { written, blocked: false };
}

export function summarize(items: readonly PlanItem[]): string[] {
  const counts = new Map<PlanAction, number>();
  for (const item of items) counts.set(item.action, (counts.get(item.action) ?? 0) + 1);
  const lines = (["create", "replace", "noop", "refused", "error"] as const).map(
    (action) => `${action.padEnd(8)} ${counts.get(action) ?? 0}`,
  );
  for (const item of items)
    if (item.action === "refused" || item.action === "error")
      lines.push(`  ${item.action} ${item.slug} [${item.locale}]: ${item.reason ?? ""}`);
  return lines;
}
