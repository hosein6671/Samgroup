#!/usr/bin/env tsx
/**
 * Executable entry for `pnpm catalog:taxonomy:fix` (ADR-030 §4).
 *
 * Dry run by default. `--apply` also needs `SAM_ALLOW_TAXONOMY_FIX=true` and
 * `--confirm-target sam_platform`, checked against `current_database()`. One SERIALIZABLE
 * transaction; re-running is a no-op. Writes only `products.category_id`,
 * `products.product_type_id`, `products.application_group_id` (cleared when a product leaves its
 * family, since a group belongs to one family) and `product_segments`, plus one
 * `product.taxonomy_changed` audit event per changed product.
 */
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../../../prisma/generated/client";

import {
  FIX_ENABLE_ENV,
  FIX_TARGET_DATABASE,
  FIXES,
  planFixes,
  planTypeNames,
} from "./taxonomy-fix";

import type { ProductState } from "./taxonomy-fix";

async function run(): Promise<number> {
  const argv = process.argv.slice(2);
  const apply = argv.includes("--apply");
  const target = argv[argv.indexOf("--confirm-target") + 1];
  const unknown = argv.filter(
    (arg, index) =>
      !["--apply", "--dry-run", "--confirm-target"].includes(arg) &&
      argv[index - 1] !== "--confirm-target",
  );
  if (unknown.length > 0) {
    console.error(`Unknown argument: ${unknown[0]}`);
    return 2;
  }
  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString) {
    console.error("DATABASE_URL is not set.");
    return 1;
  }
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    const [{ name: database } = { name: "" }] = await client.$queryRaw<
      { name: string }[]
    >`SELECT current_database() AS name`;
    const [families, types, segments, products] = await Promise.all([
      client.category.findMany({ select: { id: true, slug: true } }),
      client.productType.findMany({ select: { id: true, slug: true } }),
      client.segment.findMany({ select: { id: true, slug: true } }),
      client.product.findMany({
        where: { slug: { in: FIXES.map((fix) => fix.slug) } },
        select: {
          id: true,
          slug: true,
          category: { select: { slug: true } },
          productType: { select: { slug: true } },
          segments: { select: { segment: { select: { slug: true } } } },
        },
      }),
    ]);
    const state = new Map<string, ProductState>(
      products.map((product) => [
        product.slug,
        {
          family: product.category.slug,
          type: product.productType?.slug ?? null,
          segments: product.segments.map((membership) => membership.segment.slug),
        },
      ]),
    );
    const plan = planFixes(state, {
      families: new Set(families.map((row) => row.slug)),
      types: new Set(types.map((row) => row.slug)),
      segments: new Set(segments.map((row) => row.slug)),
    });
    const faNames = await client.contentTranslation.findMany({
      where: {
        entityType: "ProductType",
        entityId: { in: types.map((row) => row.id) },
        locale: "fa",
        field: "name",
      },
      select: { entityId: true, value: true },
    });
    const typeNames = planTypeNames(
      new Map(
        faNames.map((row) => [
          types.find((type) => type.id === row.entityId)?.slug ?? "",
          row.value,
        ]),
      ),
      new Set(types.map((row) => row.slug)),
    );
    plan.errors.push(...typeNames.errors);
    console.log(`DATABASE  ${database}\nMODE      ${apply ? "apply" : "dry run"}`);
    console.log(
      `TYPES     Persian names to add ${typeNames.add.length}, kept ${typeNames.kept.length}`,
    );
    for (const kept of typeNames.kept) console.log(`  kept ${kept}`);
    console.log(
      `PRODUCTS  change ${plan.changes.length}, unchanged ${plan.unchanged}, kept ${plan.kept.length}`,
    );
    for (const change of plan.changes)
      console.log(
        `  ${change.slug}` +
          (change.family ? ` family→${change.family}` : "") +
          (change.type ? ` type→${change.type}` : "") +
          (change.add.length ? ` +${change.add.join(",+")}` : "") +
          (change.remove.length ? ` -${change.remove.join(",-")}` : ""),
      );
    for (const kept of plan.kept) console.log(`  kept ${kept}`);
    if (plan.errors.length > 0) {
      for (const error of [...new Set(plan.errors)]) console.error(`  error ${error}`);
      console.error("Nothing written.");
      return 1;
    }
    if (!apply || plan.changes.length + typeNames.add.length === 0) return 0;
    const refusals = [
      process.env[FIX_ENABLE_ENV] !== "true" ? `${FIX_ENABLE_ENV}=true is not set.` : "",
      target !== FIX_TARGET_DATABASE ? `--confirm-target ${FIX_TARGET_DATABASE} is required.` : "",
      database !== FIX_TARGET_DATABASE
        ? `Connected to "${database}", not "${FIX_TARGET_DATABASE}".`
        : "",
    ].filter(Boolean);
    if (refusals.length > 0) {
      console.error(`Apply refused:\n  ${refusals.join("\n  ")}`);
      return 1;
    }
    const idOf = (rows: { id: string; slug: string }[], slug: string): string =>
      rows.find((row) => row.slug === slug)?.id as string;
    await client.$transaction(
      async (tx) => {
        for (const type of typeNames.add)
          await tx.contentTranslation.create({
            data: {
              entityType: "ProductType",
              entityId: idOf(types, type.slug),
              locale: "fa",
              field: "name",
              value: type.name,
              translationStatus: "HUMAN_REVIEWED",
            },
          });
        for (const change of plan.changes) {
          const product = products.find((row) => row.slug === change.slug);
          if (!product) continue;
          if (change.family || change.type)
            await tx.product.update({
              where: { id: product.id },
              data: {
                ...(change.family
                  ? { categoryId: idOf(families, change.family), applicationGroupId: null }
                  : {}),
                ...(change.type ? { productTypeId: idOf(types, change.type) } : {}),
              },
            });
          if (change.remove.length > 0)
            await tx.productSegment.deleteMany({
              where: {
                productId: product.id,
                segmentId: { in: change.remove.map((slug) => idOf(segments, slug)) },
              },
            });
          if (change.add.length > 0)
            await tx.productSegment.createMany({
              data: change.add.map((slug) => ({
                productId: product.id,
                segmentId: idOf(segments, slug),
              })),
              skipDuplicates: true,
            });
          await tx.adminAuditEvent.create({
            data: { event: "product.taxonomy_changed", outcome: "success", subjectId: product.id },
          });
        }
      },
      { isolationLevel: "Serializable" },
    );
    console.log(`WRITTEN   ${plan.changes.length} products, ${typeNames.add.length} type names`);
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
