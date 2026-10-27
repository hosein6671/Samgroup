#!/usr/bin/env tsx
/**
 * Executable entry for `pnpm catalog:content:import` (ADR-027 §5).
 *
 * Dry run is the default and opens only read queries. `--apply` additionally requires
 * `SAM_ALLOW_PRODUCT_CONTENT_IMPORT=true`, `--confirm-target sam_platform` (checked against
 * `current_database()`), `--expect-sha256 <digest of the file>` and `--operator <label>`.
 *
 * Writes go only through `ProductEditorService.save` (default locale) and
 * `ProductEditorLocalizationService.save` (every other locale) — the methods `/admin` uses —
 * so revision checks, SERIALIZABLE transactions and the audit trail are the editor's own.
 */
import "reflect-metadata";

import { readFileSync } from "node:fs";

import { PrismaPg } from "@prisma/adapter-pg";

import { ContentTranslationService } from "../../../../common/content/content-translation.service";
import { PrismaClient, TranslationStatus } from "../../../../prisma/generated/client";
import { AuditService } from "../../../audit/audit.service";
import { SeoService } from "../../../seo/seo.service";
import { ProductEditorLocalizationService } from "../../product-editor-localization.service";
import { ProductEditorService } from "../../product-editor.service";
import { productEditorialSections } from "../../product-editorial-sections";

import {
  applyAuthorizationErrors,
  applyPlan,
  parseArgs,
  planImport,
  sha256,
  summarize,
  validateContentFile,
} from "./content-import";

import type { PrismaService } from "../../../../prisma/prisma.service";
import type { SecurityAlertService } from "../../../audit/security-alert.service";
import type { EditableSeoShape, ImportDatabase, PublishedState } from "./content-import";

function prismaImportDatabase(
  client: PrismaClient,
  seo: SeoService,
  translations: ContentTranslationService,
): ImportDatabase {
  let defaultCode = "";
  return {
    async currentDatabase() {
      const rows = await client.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`;
      return rows[0]?.name ?? "";
    },
    async locales() {
      const rows = await client.locale.findMany({
        where: { isActive: true },
        select: { code: true, isDefault: true },
      });
      defaultCode = rows.find((row) => row.isDefault)?.code ?? "";
      if (!defaultCode) throw new Error("No active default locale is configured.");
      return { codes: rows.map((row) => row.code), defaultCode };
    },
    async readProduct(slug, locales) {
      const product = await client.product.findUnique({
        where: { slug },
        select: {
          id: true,
          name: true,
          sourceRef: true,
          description: true,
          editorialDraft: { select: { revision: true, publishedSections: true } },
          editorialLocalizations: {
            where: { locale: { in: [...locales] } },
            select: {
              locale: true,
              revision: true,
              publishedSections: true,
              translationStatus: true,
            },
          },
        },
      });
      if (!product) return null;
      const states = new Map<string, PublishedState>();
      for (const locale of locales) {
        const seoState = (await seo.readProductEditorial(product.id, locale)) as EditableSeoShape;
        if (locale === defaultCode) {
          states.set(locale, {
            revision: product.editorialDraft?.revision ?? 0,
            publishedSections: product.editorialDraft?.publishedSections
              ? productEditorialSections(product.editorialDraft.publishedSections)
              : null,
            description: product.description ?? "",
            seo: seoState,
          });
          continue;
        }
        const row = product.editorialLocalizations.find((item) => item.locale === locale);
        states.set(locale, {
          revision: row?.revision ?? 0,
          publishedSections: row?.publishedSections
            ? productEditorialSections(row.publishedSections)
            : null,
          description:
            (await translations.readField("Product", product.id, locale, "description")) ?? "",
          seo: seoState,
          translationStatus:
            row?.translationStatus === TranslationStatus.HUMAN_REVIEWED
              ? "human_reviewed"
              : "machine_draft",
        });
      }
      return { id: product.id, name: product.name, sourceRef: product.sourceRef, locales: states };
    },
  };
}

async function run(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  if ("error" in args) {
    console.error(args.error);
    return 2;
  }
  const bytes = readFileSync(args.file);
  const fileSha256 = sha256(bytes);
  const { entries, errors } = await validateContentFile(JSON.parse(bytes.toString("utf8")));
  console.log(`FILE      ${args.file}\nSHA-256   ${fileSha256}\nPRODUCTS  ${entries.length}`);
  if (errors.length > 0) {
    console.error(`File validation failed (${errors.length}):`);
    for (const error of errors.slice(0, 50)) console.error(`  ${error}`);
    return 1;
  }

  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString) {
    console.error("DATABASE_URL is not set.");
    return 1;
  }
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    const prisma = client as unknown as PrismaService;
    const translations = new ContentTranslationService(prisma);
    const seo = new SeoService(prisma, translations);
    // The alert hook mails the owner on security events; content publication is not one.
    const audit = new AuditService(prisma, {
      observe: () => undefined,
    } as unknown as SecurityAlertService);
    const editor = new ProductEditorService(prisma, seo, audit);
    const localized = new ProductEditorLocalizationService(prisma, seo, audit, translations);
    const database = prismaImportDatabase(client, seo, translations);

    const currentDatabase = await database.currentDatabase();
    const { defaultCode } = await database.locales();
    const items = await planImport(entries, database, {
      replace: args.replace,
      ...(args.locales ? { locales: args.locales } : {}),
    });
    console.log(`DATABASE  ${currentDatabase}\nMODE      ${args.apply ? "apply" : "dry run"}`);
    for (const line of summarize(items)) console.log(line);

    const authorization = applyAuthorizationErrors(args, process.env, fileSha256, currentDatabase);
    if (!args.apply)
      return items.some((i) => i.action === "refused" || i.action === "error") ? 1 : 0;
    if (authorization.length > 0) {
      console.error("Apply refused:");
      for (const error of authorization) console.error(`  ${error}`);
      return 1;
    }
    const result = await applyPlan(items, async (item) => {
      if (item.locale === defaultCode) await editor.save(item.productId, undefined, item.edit);
      else await localized.save(item.productId, item.locale, undefined, item.edit);
    });
    if (result.blocked) {
      console.error("Nothing written: resolve every refused or error item first.");
      return 1;
    }
    console.log(`WRITTEN   ${result.written} (operator: ${String(args.operator)})`);
    return 0;
  } finally {
    await client.$disconnect();
  }
}

run()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
