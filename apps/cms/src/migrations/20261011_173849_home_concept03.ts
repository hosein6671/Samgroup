import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres";

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_home_lists_hero_shots_source" AS ENUM('0', '1', '2', '3');
  CREATE TYPE "public"."enum__home_v_version_lists_hero_shots_source" AS ENUM('0', '1', '2', '3');
  CREATE TABLE "home_lists_hero_shots" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"source" "enum_home_lists_hero_shots_source"
  );
  
  CREATE TABLE "home_lists_hero_shots_locales" (
  	"name" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "_home_v_version_lists_hero_shots" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"source" "enum__home_v_version_lists_hero_shots_source",
  	"_uuid" varchar
  );
  
  CREATE TABLE "_home_v_version_lists_hero_shots_locales" (
  	"name" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  ALTER TABLE "home" ADD COLUMN "images_hero_shot_1_id" integer;
  ALTER TABLE "home" ADD COLUMN "images_hero_shot_2_id" integer;
  ALTER TABLE "home" ADD COLUMN "images_hero_shot_3_id" integer;
  ALTER TABLE "home" ADD COLUMN "images_hero_shot_4_id" integer;
  ALTER TABLE "home" ADD COLUMN "images_who_we_are_2_id" integer;
  ALTER TABLE "home" ADD COLUMN "images_who_we_are_3_id" integer;
  ALTER TABLE "home" ADD COLUMN "images_industry_1_id" integer;
  ALTER TABLE "home" ADD COLUMN "images_industry_2_id" integer;
  ALTER TABLE "home" ADD COLUMN "images_industry_3_id" integer;
  ALTER TABLE "home" ADD COLUMN "images_industry_4_id" integer;
  ALTER TABLE "home" ADD COLUMN "images_industry_5_id" integer;
  ALTER TABLE "home_locales" ADD COLUMN "ecosystem_portfolio_label" varchar;
  ALTER TABLE "home_locales" ADD COLUMN "ecosystem_families_count" varchar;
  ALTER TABLE "home_locales" ADD COLUMN "ecosystem_enquiry_route" varchar;
  ALTER TABLE "home_locales" ADD COLUMN "ecosystem_supplied_as" varchar;
  ALTER TABLE "home_locales" ADD COLUMN "ecosystem_enquiry_needs" varchar;
  ALTER TABLE "home_locales" ADD COLUMN "ecosystem_families_tablist_label" varchar;
  ALTER TABLE "home_locales" ADD COLUMN "ecosystem_show_details" varchar;
  ALTER TABLE "home_locales" ADD COLUMN "ecosystem_view_range" varchar;
  ALTER TABLE "home_locales" ADD COLUMN "custom_formulation_input_label" varchar;
  ALTER TABLE "home_locales" ADD COLUMN "custom_formulation_output_label" varchar;
  ALTER TABLE "home_locales" ADD COLUMN "network_hover_verb" varchar;
  ALTER TABLE "home_locales" ADD COLUMN "network_tap_verb" varchar;
  ALTER TABLE "home_locales" ADD COLUMN "network_map_description" varchar;
  ALTER TABLE "_home_v" ADD COLUMN "version_images_hero_shot_1_id" integer;
  ALTER TABLE "_home_v" ADD COLUMN "version_images_hero_shot_2_id" integer;
  ALTER TABLE "_home_v" ADD COLUMN "version_images_hero_shot_3_id" integer;
  ALTER TABLE "_home_v" ADD COLUMN "version_images_hero_shot_4_id" integer;
  ALTER TABLE "_home_v" ADD COLUMN "version_images_who_we_are_2_id" integer;
  ALTER TABLE "_home_v" ADD COLUMN "version_images_who_we_are_3_id" integer;
  ALTER TABLE "_home_v" ADD COLUMN "version_images_industry_1_id" integer;
  ALTER TABLE "_home_v" ADD COLUMN "version_images_industry_2_id" integer;
  ALTER TABLE "_home_v" ADD COLUMN "version_images_industry_3_id" integer;
  ALTER TABLE "_home_v" ADD COLUMN "version_images_industry_4_id" integer;
  ALTER TABLE "_home_v" ADD COLUMN "version_images_industry_5_id" integer;
  ALTER TABLE "_home_v_locales" ADD COLUMN "version_ecosystem_portfolio_label" varchar;
  ALTER TABLE "_home_v_locales" ADD COLUMN "version_ecosystem_families_count" varchar;
  ALTER TABLE "_home_v_locales" ADD COLUMN "version_ecosystem_enquiry_route" varchar;
  ALTER TABLE "_home_v_locales" ADD COLUMN "version_ecosystem_supplied_as" varchar;
  ALTER TABLE "_home_v_locales" ADD COLUMN "version_ecosystem_enquiry_needs" varchar;
  ALTER TABLE "_home_v_locales" ADD COLUMN "version_ecosystem_families_tablist_label" varchar;
  ALTER TABLE "_home_v_locales" ADD COLUMN "version_ecosystem_show_details" varchar;
  ALTER TABLE "_home_v_locales" ADD COLUMN "version_ecosystem_view_range" varchar;
  ALTER TABLE "_home_v_locales" ADD COLUMN "version_custom_formulation_input_label" varchar;
  ALTER TABLE "_home_v_locales" ADD COLUMN "version_custom_formulation_output_label" varchar;
  ALTER TABLE "_home_v_locales" ADD COLUMN "version_network_hover_verb" varchar;
  ALTER TABLE "_home_v_locales" ADD COLUMN "version_network_tap_verb" varchar;
  ALTER TABLE "_home_v_locales" ADD COLUMN "version_network_map_description" varchar;
  ALTER TABLE "home_lists_hero_shots" ADD CONSTRAINT "home_lists_hero_shots_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."home"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "home_lists_hero_shots_locales" ADD CONSTRAINT "home_lists_hero_shots_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."home_lists_hero_shots"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_home_v_version_lists_hero_shots" ADD CONSTRAINT "_home_v_version_lists_hero_shots_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_home_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_home_v_version_lists_hero_shots_locales" ADD CONSTRAINT "_home_v_version_lists_hero_shots_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_home_v_version_lists_hero_shots"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "home_lists_hero_shots_order_idx" ON "home_lists_hero_shots" USING btree ("_order");
  CREATE INDEX "home_lists_hero_shots_parent_id_idx" ON "home_lists_hero_shots" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "home_lists_hero_shots_locales_locale_parent_id_unique" ON "home_lists_hero_shots_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_home_v_version_lists_hero_shots_order_idx" ON "_home_v_version_lists_hero_shots" USING btree ("_order");
  CREATE INDEX "_home_v_version_lists_hero_shots_parent_id_idx" ON "_home_v_version_lists_hero_shots" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_home_v_version_lists_hero_shots_locales_locale_parent_id_un" ON "_home_v_version_lists_hero_shots_locales" USING btree ("_locale","_parent_id");
  ALTER TABLE "home" ADD CONSTRAINT "home_images_hero_shot_1_id_media_id_fk" FOREIGN KEY ("images_hero_shot_1_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "home" ADD CONSTRAINT "home_images_hero_shot_2_id_media_id_fk" FOREIGN KEY ("images_hero_shot_2_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "home" ADD CONSTRAINT "home_images_hero_shot_3_id_media_id_fk" FOREIGN KEY ("images_hero_shot_3_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "home" ADD CONSTRAINT "home_images_hero_shot_4_id_media_id_fk" FOREIGN KEY ("images_hero_shot_4_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "home" ADD CONSTRAINT "home_images_who_we_are_2_id_media_id_fk" FOREIGN KEY ("images_who_we_are_2_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "home" ADD CONSTRAINT "home_images_who_we_are_3_id_media_id_fk" FOREIGN KEY ("images_who_we_are_3_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "home" ADD CONSTRAINT "home_images_industry_1_id_media_id_fk" FOREIGN KEY ("images_industry_1_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "home" ADD CONSTRAINT "home_images_industry_2_id_media_id_fk" FOREIGN KEY ("images_industry_2_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "home" ADD CONSTRAINT "home_images_industry_3_id_media_id_fk" FOREIGN KEY ("images_industry_3_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "home" ADD CONSTRAINT "home_images_industry_4_id_media_id_fk" FOREIGN KEY ("images_industry_4_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "home" ADD CONSTRAINT "home_images_industry_5_id_media_id_fk" FOREIGN KEY ("images_industry_5_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_home_v" ADD CONSTRAINT "_home_v_version_images_hero_shot_1_id_media_id_fk" FOREIGN KEY ("version_images_hero_shot_1_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_home_v" ADD CONSTRAINT "_home_v_version_images_hero_shot_2_id_media_id_fk" FOREIGN KEY ("version_images_hero_shot_2_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_home_v" ADD CONSTRAINT "_home_v_version_images_hero_shot_3_id_media_id_fk" FOREIGN KEY ("version_images_hero_shot_3_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_home_v" ADD CONSTRAINT "_home_v_version_images_hero_shot_4_id_media_id_fk" FOREIGN KEY ("version_images_hero_shot_4_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_home_v" ADD CONSTRAINT "_home_v_version_images_who_we_are_2_id_media_id_fk" FOREIGN KEY ("version_images_who_we_are_2_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_home_v" ADD CONSTRAINT "_home_v_version_images_who_we_are_3_id_media_id_fk" FOREIGN KEY ("version_images_who_we_are_3_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_home_v" ADD CONSTRAINT "_home_v_version_images_industry_1_id_media_id_fk" FOREIGN KEY ("version_images_industry_1_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_home_v" ADD CONSTRAINT "_home_v_version_images_industry_2_id_media_id_fk" FOREIGN KEY ("version_images_industry_2_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_home_v" ADD CONSTRAINT "_home_v_version_images_industry_3_id_media_id_fk" FOREIGN KEY ("version_images_industry_3_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_home_v" ADD CONSTRAINT "_home_v_version_images_industry_4_id_media_id_fk" FOREIGN KEY ("version_images_industry_4_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_home_v" ADD CONSTRAINT "_home_v_version_images_industry_5_id_media_id_fk" FOREIGN KEY ("version_images_industry_5_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "home_images_images_hero_shot_1_idx" ON "home" USING btree ("images_hero_shot_1_id");
  CREATE INDEX "home_images_images_hero_shot_2_idx" ON "home" USING btree ("images_hero_shot_2_id");
  CREATE INDEX "home_images_images_hero_shot_3_idx" ON "home" USING btree ("images_hero_shot_3_id");
  CREATE INDEX "home_images_images_hero_shot_4_idx" ON "home" USING btree ("images_hero_shot_4_id");
  CREATE INDEX "home_images_images_who_we_are_2_idx" ON "home" USING btree ("images_who_we_are_2_id");
  CREATE INDEX "home_images_images_who_we_are_3_idx" ON "home" USING btree ("images_who_we_are_3_id");
  CREATE INDEX "home_images_images_industry_1_idx" ON "home" USING btree ("images_industry_1_id");
  CREATE INDEX "home_images_images_industry_2_idx" ON "home" USING btree ("images_industry_2_id");
  CREATE INDEX "home_images_images_industry_3_idx" ON "home" USING btree ("images_industry_3_id");
  CREATE INDEX "home_images_images_industry_4_idx" ON "home" USING btree ("images_industry_4_id");
  CREATE INDEX "home_images_images_industry_5_idx" ON "home" USING btree ("images_industry_5_id");
  CREATE INDEX "_home_v_version_images_version_images_hero_shot_1_idx" ON "_home_v" USING btree ("version_images_hero_shot_1_id");
  CREATE INDEX "_home_v_version_images_version_images_hero_shot_2_idx" ON "_home_v" USING btree ("version_images_hero_shot_2_id");
  CREATE INDEX "_home_v_version_images_version_images_hero_shot_3_idx" ON "_home_v" USING btree ("version_images_hero_shot_3_id");
  CREATE INDEX "_home_v_version_images_version_images_hero_shot_4_idx" ON "_home_v" USING btree ("version_images_hero_shot_4_id");
  CREATE INDEX "_home_v_version_images_version_images_who_we_are_2_idx" ON "_home_v" USING btree ("version_images_who_we_are_2_id");
  CREATE INDEX "_home_v_version_images_version_images_who_we_are_3_idx" ON "_home_v" USING btree ("version_images_who_we_are_3_id");
  CREATE INDEX "_home_v_version_images_version_images_industry_1_idx" ON "_home_v" USING btree ("version_images_industry_1_id");
  CREATE INDEX "_home_v_version_images_version_images_industry_2_idx" ON "_home_v" USING btree ("version_images_industry_2_id");
  CREATE INDEX "_home_v_version_images_version_images_industry_3_idx" ON "_home_v" USING btree ("version_images_industry_3_id");
  CREATE INDEX "_home_v_version_images_version_images_industry_4_idx" ON "_home_v" USING btree ("version_images_industry_4_id");
  CREATE INDEX "_home_v_version_images_version_images_industry_5_idx" ON "_home_v" USING btree ("version_images_industry_5_id");`);

  /*
   * Carry today's values into content that already exists, so a Home page published before this
   * migration stays valid. The content service serves a structural page only when every text slot
   * is filled and every list is present; a document missing the new slots would be withheld whole,
   * and every edit an editor has published would vanish from the live page until re-published.
   *
   * - `hero_shots` is filled with the four shot names (an empty list would stop the reel).
   * - The new `ecosystem`, `custom_formulation` and `network` text slots get today's wording.
   *
   * Frozen values, written only where empty (NOT EXISTS / COALESCE), so nothing an editor saved is
   * overwritten; list item ids are identical across the main table and versions. Only `en` is
   * filled: it is the only locale the content service reads. The photograph columns need no fill:
   * an empty slot keeps the built-in photograph.
   */
  await db.execute(sql`
  WITH src (source, ord, name) AS (
    VALUES
      ('0', 1, 'Base Oils'),
      ('1', 2, 'Engine Oils'),
      ('2', 3, 'Industrial'),
      ('3', 4, 'Marine')
  ), ins AS (
    INSERT INTO "home_lists_hero_shots" ("_order", "_parent_id", "id", "source")
    SELECT s.ord, p.id, substr(md5('home_lists_hero_shots:' || s.source || ':' || p.id::text), 1, 24), s.source::"enum_home_lists_hero_shots_source"
    FROM "home" p CROSS JOIN src s
    WHERE NOT EXISTS (SELECT 1 FROM "home_lists_hero_shots" x WHERE x."_parent_id" = p.id)
    RETURNING "id", "_parent_id", "source"
  )
  INSERT INTO "home_lists_hero_shots_locales" ("name", "_locale", "_parent_id")
  SELECT s."name", 'en', ins."id" FROM ins JOIN src s ON s.source = ins."source"::text;

  WITH src (source, ord, name) AS (
    VALUES
      ('0', 1, 'Base Oils'),
      ('1', 2, 'Engine Oils'),
      ('2', 3, 'Industrial'),
      ('3', 4, 'Marine')
  ), ins AS (
    INSERT INTO "_home_v_version_lists_hero_shots" ("_order", "_parent_id", "_uuid", "source")
    SELECT s.ord, p.id, substr(md5('home_lists_hero_shots:' || s.source || ':' || COALESCE((SELECT min("id") FROM "home"), 0)::text), 1, 24), s.source::"enum__home_v_version_lists_hero_shots_source"
    FROM "_home_v" p CROSS JOIN src s
    WHERE NOT EXISTS (SELECT 1 FROM "_home_v_version_lists_hero_shots" x WHERE x."_parent_id" = p.id)
    RETURNING "id", "_parent_id", "source"
  )
  INSERT INTO "_home_v_version_lists_hero_shots_locales" ("name", "_locale", "_parent_id")
  SELECT s."name", 'en', ins."id" FROM ins JOIN src s ON s.source = ins."source"::text;

  UPDATE "home_locales" SET
    "ecosystem_portfolio_label" = COALESCE("ecosystem_portfolio_label", 'Product portfolio'),
    "ecosystem_families_count" = COALESCE("ecosystem_families_count", 'Six families'),
    "ecosystem_enquiry_route" = COALESCE("ecosystem_enquiry_route", 'One enquiry route'),
    "ecosystem_supplied_as" = COALESCE("ecosystem_supplied_as", 'Supplied as'),
    "ecosystem_enquiry_needs" = COALESCE("ecosystem_enquiry_needs", 'Enquiry needs'),
    "ecosystem_families_tablist_label" = COALESCE("ecosystem_families_tablist_label", 'Product families'),
    "ecosystem_show_details" = COALESCE("ecosystem_show_details", 'show details'),
    "ecosystem_view_range" = COALESCE("ecosystem_view_range", 'View'),
    "custom_formulation_input_label" = COALESCE("custom_formulation_input_label", 'Input'),
    "custom_formulation_output_label" = COALESCE("custom_formulation_output_label", 'Output'),
    "network_hover_verb" = COALESCE("network_hover_verb", 'Hover'),
    "network_tap_verb" = COALESCE("network_tap_verb", 'Tap'),
    "network_map_description" = COALESCE("network_map_description", 'World map marking the regions SAM Group exports to: Türkiye, the countries around India, and Africa. Every destination is listed as text beneath the map.')
  WHERE "_locale" = 'en';

  UPDATE "_home_v_locales" SET
    "version_ecosystem_portfolio_label" = COALESCE("version_ecosystem_portfolio_label", 'Product portfolio'),
    "version_ecosystem_families_count" = COALESCE("version_ecosystem_families_count", 'Six families'),
    "version_ecosystem_enquiry_route" = COALESCE("version_ecosystem_enquiry_route", 'One enquiry route'),
    "version_ecosystem_supplied_as" = COALESCE("version_ecosystem_supplied_as", 'Supplied as'),
    "version_ecosystem_enquiry_needs" = COALESCE("version_ecosystem_enquiry_needs", 'Enquiry needs'),
    "version_ecosystem_families_tablist_label" = COALESCE("version_ecosystem_families_tablist_label", 'Product families'),
    "version_ecosystem_show_details" = COALESCE("version_ecosystem_show_details", 'show details'),
    "version_ecosystem_view_range" = COALESCE("version_ecosystem_view_range", 'View'),
    "version_custom_formulation_input_label" = COALESCE("version_custom_formulation_input_label", 'Input'),
    "version_custom_formulation_output_label" = COALESCE("version_custom_formulation_output_label", 'Output'),
    "version_network_hover_verb" = COALESCE("version_network_hover_verb", 'Hover'),
    "version_network_tap_verb" = COALESCE("version_network_tap_verb", 'Tap'),
    "version_network_map_description" = COALESCE("version_network_map_description", 'World map marking the regions SAM Group exports to: Türkiye, the countries around India, and Africa. Every destination is listed as text beneath the map.')
  WHERE "_locale" = 'en';`);
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "home_lists_hero_shots" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "home_lists_hero_shots_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_home_v_version_lists_hero_shots" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_home_v_version_lists_hero_shots_locales" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "home_lists_hero_shots" CASCADE;
  DROP TABLE "home_lists_hero_shots_locales" CASCADE;
  DROP TABLE "_home_v_version_lists_hero_shots" CASCADE;
  DROP TABLE "_home_v_version_lists_hero_shots_locales" CASCADE;
  ALTER TABLE "home" DROP CONSTRAINT "home_images_hero_shot_1_id_media_id_fk";
  
  ALTER TABLE "home" DROP CONSTRAINT "home_images_hero_shot_2_id_media_id_fk";
  
  ALTER TABLE "home" DROP CONSTRAINT "home_images_hero_shot_3_id_media_id_fk";
  
  ALTER TABLE "home" DROP CONSTRAINT "home_images_hero_shot_4_id_media_id_fk";
  
  ALTER TABLE "home" DROP CONSTRAINT "home_images_who_we_are_2_id_media_id_fk";
  
  ALTER TABLE "home" DROP CONSTRAINT "home_images_who_we_are_3_id_media_id_fk";
  
  ALTER TABLE "home" DROP CONSTRAINT "home_images_industry_1_id_media_id_fk";
  
  ALTER TABLE "home" DROP CONSTRAINT "home_images_industry_2_id_media_id_fk";
  
  ALTER TABLE "home" DROP CONSTRAINT "home_images_industry_3_id_media_id_fk";
  
  ALTER TABLE "home" DROP CONSTRAINT "home_images_industry_4_id_media_id_fk";
  
  ALTER TABLE "home" DROP CONSTRAINT "home_images_industry_5_id_media_id_fk";
  
  ALTER TABLE "_home_v" DROP CONSTRAINT "_home_v_version_images_hero_shot_1_id_media_id_fk";
  
  ALTER TABLE "_home_v" DROP CONSTRAINT "_home_v_version_images_hero_shot_2_id_media_id_fk";
  
  ALTER TABLE "_home_v" DROP CONSTRAINT "_home_v_version_images_hero_shot_3_id_media_id_fk";
  
  ALTER TABLE "_home_v" DROP CONSTRAINT "_home_v_version_images_hero_shot_4_id_media_id_fk";
  
  ALTER TABLE "_home_v" DROP CONSTRAINT "_home_v_version_images_who_we_are_2_id_media_id_fk";
  
  ALTER TABLE "_home_v" DROP CONSTRAINT "_home_v_version_images_who_we_are_3_id_media_id_fk";
  
  ALTER TABLE "_home_v" DROP CONSTRAINT "_home_v_version_images_industry_1_id_media_id_fk";
  
  ALTER TABLE "_home_v" DROP CONSTRAINT "_home_v_version_images_industry_2_id_media_id_fk";
  
  ALTER TABLE "_home_v" DROP CONSTRAINT "_home_v_version_images_industry_3_id_media_id_fk";
  
  ALTER TABLE "_home_v" DROP CONSTRAINT "_home_v_version_images_industry_4_id_media_id_fk";
  
  ALTER TABLE "_home_v" DROP CONSTRAINT "_home_v_version_images_industry_5_id_media_id_fk";
  
  DROP INDEX "home_images_images_hero_shot_1_idx";
  DROP INDEX "home_images_images_hero_shot_2_idx";
  DROP INDEX "home_images_images_hero_shot_3_idx";
  DROP INDEX "home_images_images_hero_shot_4_idx";
  DROP INDEX "home_images_images_who_we_are_2_idx";
  DROP INDEX "home_images_images_who_we_are_3_idx";
  DROP INDEX "home_images_images_industry_1_idx";
  DROP INDEX "home_images_images_industry_2_idx";
  DROP INDEX "home_images_images_industry_3_idx";
  DROP INDEX "home_images_images_industry_4_idx";
  DROP INDEX "home_images_images_industry_5_idx";
  DROP INDEX "_home_v_version_images_version_images_hero_shot_1_idx";
  DROP INDEX "_home_v_version_images_version_images_hero_shot_2_idx";
  DROP INDEX "_home_v_version_images_version_images_hero_shot_3_idx";
  DROP INDEX "_home_v_version_images_version_images_hero_shot_4_idx";
  DROP INDEX "_home_v_version_images_version_images_who_we_are_2_idx";
  DROP INDEX "_home_v_version_images_version_images_who_we_are_3_idx";
  DROP INDEX "_home_v_version_images_version_images_industry_1_idx";
  DROP INDEX "_home_v_version_images_version_images_industry_2_idx";
  DROP INDEX "_home_v_version_images_version_images_industry_3_idx";
  DROP INDEX "_home_v_version_images_version_images_industry_4_idx";
  DROP INDEX "_home_v_version_images_version_images_industry_5_idx";
  ALTER TABLE "home" DROP COLUMN "images_hero_shot_1_id";
  ALTER TABLE "home" DROP COLUMN "images_hero_shot_2_id";
  ALTER TABLE "home" DROP COLUMN "images_hero_shot_3_id";
  ALTER TABLE "home" DROP COLUMN "images_hero_shot_4_id";
  ALTER TABLE "home" DROP COLUMN "images_who_we_are_2_id";
  ALTER TABLE "home" DROP COLUMN "images_who_we_are_3_id";
  ALTER TABLE "home" DROP COLUMN "images_industry_1_id";
  ALTER TABLE "home" DROP COLUMN "images_industry_2_id";
  ALTER TABLE "home" DROP COLUMN "images_industry_3_id";
  ALTER TABLE "home" DROP COLUMN "images_industry_4_id";
  ALTER TABLE "home" DROP COLUMN "images_industry_5_id";
  ALTER TABLE "home_locales" DROP COLUMN "ecosystem_portfolio_label";
  ALTER TABLE "home_locales" DROP COLUMN "ecosystem_families_count";
  ALTER TABLE "home_locales" DROP COLUMN "ecosystem_enquiry_route";
  ALTER TABLE "home_locales" DROP COLUMN "ecosystem_supplied_as";
  ALTER TABLE "home_locales" DROP COLUMN "ecosystem_enquiry_needs";
  ALTER TABLE "home_locales" DROP COLUMN "ecosystem_families_tablist_label";
  ALTER TABLE "home_locales" DROP COLUMN "ecosystem_show_details";
  ALTER TABLE "home_locales" DROP COLUMN "ecosystem_view_range";
  ALTER TABLE "home_locales" DROP COLUMN "custom_formulation_input_label";
  ALTER TABLE "home_locales" DROP COLUMN "custom_formulation_output_label";
  ALTER TABLE "home_locales" DROP COLUMN "network_hover_verb";
  ALTER TABLE "home_locales" DROP COLUMN "network_tap_verb";
  ALTER TABLE "home_locales" DROP COLUMN "network_map_description";
  ALTER TABLE "_home_v" DROP COLUMN "version_images_hero_shot_1_id";
  ALTER TABLE "_home_v" DROP COLUMN "version_images_hero_shot_2_id";
  ALTER TABLE "_home_v" DROP COLUMN "version_images_hero_shot_3_id";
  ALTER TABLE "_home_v" DROP COLUMN "version_images_hero_shot_4_id";
  ALTER TABLE "_home_v" DROP COLUMN "version_images_who_we_are_2_id";
  ALTER TABLE "_home_v" DROP COLUMN "version_images_who_we_are_3_id";
  ALTER TABLE "_home_v" DROP COLUMN "version_images_industry_1_id";
  ALTER TABLE "_home_v" DROP COLUMN "version_images_industry_2_id";
  ALTER TABLE "_home_v" DROP COLUMN "version_images_industry_3_id";
  ALTER TABLE "_home_v" DROP COLUMN "version_images_industry_4_id";
  ALTER TABLE "_home_v" DROP COLUMN "version_images_industry_5_id";
  ALTER TABLE "_home_v_locales" DROP COLUMN "version_ecosystem_portfolio_label";
  ALTER TABLE "_home_v_locales" DROP COLUMN "version_ecosystem_families_count";
  ALTER TABLE "_home_v_locales" DROP COLUMN "version_ecosystem_enquiry_route";
  ALTER TABLE "_home_v_locales" DROP COLUMN "version_ecosystem_supplied_as";
  ALTER TABLE "_home_v_locales" DROP COLUMN "version_ecosystem_enquiry_needs";
  ALTER TABLE "_home_v_locales" DROP COLUMN "version_ecosystem_families_tablist_label";
  ALTER TABLE "_home_v_locales" DROP COLUMN "version_ecosystem_show_details";
  ALTER TABLE "_home_v_locales" DROP COLUMN "version_ecosystem_view_range";
  ALTER TABLE "_home_v_locales" DROP COLUMN "version_custom_formulation_input_label";
  ALTER TABLE "_home_v_locales" DROP COLUMN "version_custom_formulation_output_label";
  ALTER TABLE "_home_v_locales" DROP COLUMN "version_network_hover_verb";
  ALTER TABLE "_home_v_locales" DROP COLUMN "version_network_tap_verb";
  ALTER TABLE "_home_v_locales" DROP COLUMN "version_network_map_description";
  DROP TYPE "public"."enum_home_lists_hero_shots_source";
  DROP TYPE "public"."enum__home_v_version_lists_hero_shots_source";`);
}
