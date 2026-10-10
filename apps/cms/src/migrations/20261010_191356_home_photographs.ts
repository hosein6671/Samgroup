import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres";

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "home" ADD COLUMN "images_who_we_are_id" integer;
  ALTER TABLE "home" ADD COLUMN "images_custom_formulation_id" integer;
  ALTER TABLE "home" ADD COLUMN "images_network_id" integer;
  ALTER TABLE "_home_v" ADD COLUMN "version_images_who_we_are_id" integer;
  ALTER TABLE "_home_v" ADD COLUMN "version_images_custom_formulation_id" integer;
  ALTER TABLE "_home_v" ADD COLUMN "version_images_network_id" integer;
  ALTER TABLE "home" ADD CONSTRAINT "home_images_who_we_are_id_media_id_fk" FOREIGN KEY ("images_who_we_are_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "home" ADD CONSTRAINT "home_images_custom_formulation_id_media_id_fk" FOREIGN KEY ("images_custom_formulation_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "home" ADD CONSTRAINT "home_images_network_id_media_id_fk" FOREIGN KEY ("images_network_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_home_v" ADD CONSTRAINT "_home_v_version_images_who_we_are_id_media_id_fk" FOREIGN KEY ("version_images_who_we_are_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_home_v" ADD CONSTRAINT "_home_v_version_images_custom_formulation_id_media_id_fk" FOREIGN KEY ("version_images_custom_formulation_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_home_v" ADD CONSTRAINT "_home_v_version_images_network_id_media_id_fk" FOREIGN KEY ("version_images_network_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "home_images_images_who_we_are_idx" ON "home" USING btree ("images_who_we_are_id");
  CREATE INDEX "home_images_images_custom_formulation_idx" ON "home" USING btree ("images_custom_formulation_id");
  CREATE INDEX "home_images_images_network_idx" ON "home" USING btree ("images_network_id");
  CREATE INDEX "_home_v_version_images_version_images_who_we_are_idx" ON "_home_v" USING btree ("version_images_who_we_are_id");
  CREATE INDEX "_home_v_version_images_version_images_custom_formulation_idx" ON "_home_v" USING btree ("version_images_custom_formulation_id");
  CREATE INDEX "_home_v_version_images_version_images_network_idx" ON "_home_v" USING btree ("version_images_network_id");`);
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "home" DROP CONSTRAINT "home_images_who_we_are_id_media_id_fk";
  
  ALTER TABLE "home" DROP CONSTRAINT "home_images_custom_formulation_id_media_id_fk";
  
  ALTER TABLE "home" DROP CONSTRAINT "home_images_network_id_media_id_fk";
  
  ALTER TABLE "_home_v" DROP CONSTRAINT "_home_v_version_images_who_we_are_id_media_id_fk";
  
  ALTER TABLE "_home_v" DROP CONSTRAINT "_home_v_version_images_custom_formulation_id_media_id_fk";
  
  ALTER TABLE "_home_v" DROP CONSTRAINT "_home_v_version_images_network_id_media_id_fk";
  
  DROP INDEX "home_images_images_who_we_are_idx";
  DROP INDEX "home_images_images_custom_formulation_idx";
  DROP INDEX "home_images_images_network_idx";
  DROP INDEX "_home_v_version_images_version_images_who_we_are_idx";
  DROP INDEX "_home_v_version_images_version_images_custom_formulation_idx";
  DROP INDEX "_home_v_version_images_version_images_network_idx";
  ALTER TABLE "home" DROP COLUMN "images_who_we_are_id";
  ALTER TABLE "home" DROP COLUMN "images_custom_formulation_id";
  ALTER TABLE "home" DROP COLUMN "images_network_id";
  ALTER TABLE "_home_v" DROP COLUMN "version_images_who_we_are_id";
  ALTER TABLE "_home_v" DROP COLUMN "version_images_custom_formulation_id";
  ALTER TABLE "_home_v" DROP COLUMN "version_images_network_id";`);
}
