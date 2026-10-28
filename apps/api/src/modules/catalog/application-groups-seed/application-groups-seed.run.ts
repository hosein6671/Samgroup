#!/usr/bin/env tsx
/**
 * Executable entry for `pnpm catalog:groups:seed` (ADR-029 §3).
 *
 * Dry run by default. `--apply` also needs `SAM_ALLOW_APPLICATION_GROUP_SEED=true` and
 * `--confirm-target sam_platform`, checked against `current_database()`. One SERIALIZABLE
 * transaction; re-running is a no-op. Writes only `application_groups`, their Persian names in
 * `content_translations`, and `products.application_group_id` where it is still empty.
 */
import { randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../../../prisma/generated/client";

import {
  FAMILY_SLUG,
  INDUSTRIAL_GROUPS,
  planSeed,
  SEED_ENABLE_ENV,
  SEED_TARGET_DATABASE,
} from "./application-groups-seed";

import type { SeedState } from "./application-groups-seed";

async function readState(client: PrismaClient): Promise<SeedState> {
  const category = await client.category.findUnique({
    where: { slug: FAMILY_SLUG },
    select: { id: true },
  });
  const groups = category
    ? await client.applicationGroup.findMany({
        where: { categoryId: category.id },
        select: { id: true, slug: true },
      })
    : [];
  const fa = await client.contentTranslation.findMany({
    where: {
      entityType: "ApplicationGroup",
      entityId: { in: groups.map((group) => group.id) },
      locale: "fa",
      field: "name",
    },
    select: { entityId: true },
  });
  const slugs = INDUSTRIAL_GROUPS.flatMap((group) => group.products);
  const products = await client.product.findMany({
    where: { slug: { in: slugs } },
    select: {
      id: true,
      slug: true,
      categoryId: true,
      applicationGroup: { select: { slug: true } },
    },
  });
  return {
    categoryId: category?.id ?? null,
    groups: new Map(
      groups.map((group) => [
        group.slug,
        { id: group.id, hasFa: fa.some((row) => row.entityId === group.id) },
      ]),
    ),
    products: new Map(
      products.map((product) => [
        product.slug,
        {
          id: product.id,
          categoryId: product.categoryId,
          groupSlug: product.applicationGroup?.slug ?? null,
        },
      ]),
    ),
  };
}

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
    const state = await readState(client);
    const plan = planSeed(state);
    console.log(`DATABASE  ${database}\nMODE      ${apply ? "apply" : "dry run"}`);
    console.log(`FAMILY    ${FAMILY_SLUG}`);
    console.log(
      `GROUPS    create ${plan.createGroups.length}, Persian names ${plan.addFaNames.length}`,
    );
    console.log(
      `PRODUCTS  assign ${plan.assign.length}, already ${plan.alreadyAssigned}, kept ${plan.keptElsewhere.length}`,
    );
    for (const kept of plan.keptElsewhere)
      console.log(`  kept ${kept.productSlug} in ${kept.current} (plan: ${kept.groupSlug})`);
    if (plan.errors.length > 0) {
      for (const error of plan.errors) console.error(`  error ${error}`);
      console.error("Nothing written.");
      return 1;
    }
    if (!apply) return 0;
    const refusals = [
      process.env[SEED_ENABLE_ENV] !== "true" ? `${SEED_ENABLE_ENV}=true is not set.` : "",
      target !== SEED_TARGET_DATABASE
        ? `--confirm-target ${SEED_TARGET_DATABASE} is required.`
        : "",
      database !== SEED_TARGET_DATABASE
        ? `Connected to "${database}", not "${SEED_TARGET_DATABASE}".`
        : "",
    ].filter(Boolean);
    if (refusals.length > 0) {
      console.error(`Apply refused:\n  ${refusals.join("\n  ")}`);
      return 1;
    }
    const categoryId = state.categoryId as string;
    await client.$transaction(
      async (tx) => {
        const ids = new Map([...state.groups].map(([slug, group]) => [slug, group.id]));
        for (const [index, group] of INDUSTRIAL_GROUPS.entries()) {
          if (ids.has(group.slug)) continue;
          const id = randomUUID();
          await tx.applicationGroup.create({
            data: { id, categoryId, slug: group.slug, name: group.name, sortOrder: index + 1 },
          });
          await tx.adminAuditEvent.create({
            data: { event: "application_group.created", outcome: "success", subjectId: id },
          });
          ids.set(group.slug, id);
        }
        for (const group of plan.addFaNames)
          await tx.contentTranslation.create({
            data: {
              entityType: "ApplicationGroup",
              entityId: ids.get(group.slug) as string,
              locale: "fa",
              field: "name",
              value: group.fa,
              translationStatus: "MACHINE_DRAFT",
            },
          });
        for (const item of plan.assign) {
          // Only a product that still has no group: one placed meanwhile is left alone.
          const updated = await tx.product.updateMany({
            where: { slug: item.productSlug, applicationGroupId: null },
            data: { applicationGroupId: ids.get(item.groupSlug) as string },
          });
          if (updated.count === 1) {
            const product = state.products.get(item.productSlug);
            await tx.adminAuditEvent.create({
              data: {
                event: "product.application_group_changed",
                outcome: "success",
                subjectId: product?.id,
              },
            });
          }
        }
      },
      { isolationLevel: "Serializable" },
    );
    console.log("WRITTEN");
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
