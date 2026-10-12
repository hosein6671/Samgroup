import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres";

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "home_lists_industries_locales" ADD COLUMN "href" varchar;
  ALTER TABLE "_home_v_version_lists_industries_locales" ADD COLUMN "href" varchar;`);
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "home_lists_industries_locales" DROP COLUMN "href";
  ALTER TABLE "_home_v_version_lists_industries_locales" DROP COLUMN "href";`);
}
