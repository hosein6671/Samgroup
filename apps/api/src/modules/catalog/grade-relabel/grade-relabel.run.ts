#!/usr/bin/env tsx
/**
 * Executable entry for `pnpm catalog:grades:relabel` (ADR-028 §4, operations gate).
 *
 * Dry run by default. `--apply` also needs `SAM_ALLOW_GRADE_RELABEL=true` and
 * `--confirm-target sam_platform`, checked against `current_database()`. The write is one
 * transaction that updates `product_grades.display_label` on the planned rows only and appends
 * one `product.grade_relabelled` audit event per changed grade. Re-running is a no-op.
 */
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../../../prisma/generated/client";

import {
  planRelabel,
  RELABEL_ENABLE_ENV,
  RELABEL_TARGET_DATABASE,
  TURBINE_OIL_NAME,
  TURBINE_OIL_SLUG,
} from "./grade-relabel";

async function run(): Promise<number> {
  const argv = process.argv.slice(2);
  const unknown = argv.filter(
    (arg, index) =>
      !["--apply", "--dry-run", "--confirm-target"].includes(arg) &&
      argv[index - 1] !== "--confirm-target",
  );
  if (unknown.length > 0) {
    console.error(`Unknown argument: ${unknown[0]}`);
    return 2;
  }
  const apply = argv.includes("--apply");
  const target = argv[argv.indexOf("--confirm-target") + 1];
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
    const product = await client.product.findUnique({
      where: { slug: TURBINE_OIL_SLUG },
      select: {
        id: true,
        name: true,
        grades: {
          select: { id: true, label: true, displayLabel: true },
          orderBy: { sortOrder: "asc" },
        },
      },
    });
    // The name is checked too, so a slug reused by another product can never be relabelled.
    const plan = planRelabel(product?.name === TURBINE_OIL_NAME ? product.grades : null);
    console.log(`DATABASE  ${database}\nMODE      ${apply ? "apply" : "dry run"}`);
    if (!plan.ok) {
      console.error(plan.error);
      return 1;
    }
    console.log(`PRODUCT   ${TURBINE_OIL_NAME} (/${TURBINE_OIL_SLUG})`);
    for (const change of plan.changes)
      console.log(
        `  ${change.label}  →  ${change.to}${change.from ? ` (was ${change.from})` : ""}`,
      );
    console.log(`CHANGE    ${plan.changes.length}\nUNCHANGED ${plan.unchanged}`);
    if (!apply || plan.changes.length === 0) return 0;

    const refusals = [
      process.env[RELABEL_ENABLE_ENV] !== "true" ? `${RELABEL_ENABLE_ENV}=true is not set.` : "",
      target !== RELABEL_TARGET_DATABASE
        ? `--confirm-target ${RELABEL_TARGET_DATABASE} is required.`
        : "",
      database !== RELABEL_TARGET_DATABASE
        ? `Connected to "${database}", not "${RELABEL_TARGET_DATABASE}".`
        : "",
    ].filter(Boolean);
    if (refusals.length > 0) {
      console.error(`Apply refused:\n  ${refusals.join("\n  ")}`);
      return 1;
    }
    await client.$transaction(
      async (tx) => {
        for (const change of plan.changes) {
          // `label` is in the WHERE clause so a row that changed since planning is not touched.
          const updated = await tx.productGrade.updateMany({
            where: { id: change.id, label: change.label, displayLabel: change.from },
            data: { displayLabel: change.to },
          });
          if (updated.count !== 1) throw new Error(`Grade ${change.id} changed since planning.`);
          await tx.adminAuditEvent.create({
            data: { event: "product.grade_relabelled", outcome: "success", subjectId: change.id },
          });
        }
      },
      { isolationLevel: "Serializable" },
    );
    console.log(`WRITTEN   ${plan.changes.length}`);
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
