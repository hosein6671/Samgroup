import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres";

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_home_lists_hero_facts_source" AS ENUM('0', '1', '2');
  CREATE TYPE "public"."enum_home_lists_families_source" AS ENUM('0', '1', '2', '3', '4', '5');
  CREATE TYPE "public"."enum_home_lists_network_hubs_source" AS ENUM('0', '1', '2', '3', '4', '5');
  CREATE TYPE "public"."enum_home_lists_network_stats_source" AS ENUM('0', '1', '2');
  CREATE TYPE "public"."enum__home_v_version_lists_hero_facts_source" AS ENUM('0', '1', '2');
  CREATE TYPE "public"."enum__home_v_version_lists_families_source" AS ENUM('0', '1', '2', '3', '4', '5');
  CREATE TYPE "public"."enum__home_v_version_lists_network_hubs_source" AS ENUM('0', '1', '2', '3', '4', '5');
  CREATE TYPE "public"."enum__home_v_version_lists_network_stats_source" AS ENUM('0', '1', '2');
  CREATE TABLE "home_lists_hero_facts" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"source" "enum_home_lists_hero_facts_source"
  );
  
  CREATE TABLE "home_lists_hero_facts_locales" (
  	"label" varchar,
  	"value" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "home_lists_families" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"source" "enum_home_lists_families_source"
  );
  
  CREATE TABLE "home_lists_families_locales" (
  	"name" varchar,
  	"short" varchar,
  	"sub" varchar,
  	"body" varchar,
  	"supplied" varchar,
  	"enquiry" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "home_lists_network_hubs" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"source" "enum_home_lists_network_hubs_source"
  );
  
  CREATE TABLE "home_lists_network_hubs_locales" (
  	"n" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "home_lists_network_stats" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"source" "enum_home_lists_network_stats_source"
  );
  
  CREATE TABLE "home_lists_network_stats_locales" (
  	"label" varchar,
  	"value" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "_home_v_version_lists_hero_facts" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"source" "enum__home_v_version_lists_hero_facts_source",
  	"_uuid" varchar
  );
  
  CREATE TABLE "_home_v_version_lists_hero_facts_locales" (
  	"label" varchar,
  	"value" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_home_v_version_lists_families" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"source" "enum__home_v_version_lists_families_source",
  	"_uuid" varchar
  );
  
  CREATE TABLE "_home_v_version_lists_families_locales" (
  	"name" varchar,
  	"short" varchar,
  	"sub" varchar,
  	"body" varchar,
  	"supplied" varchar,
  	"enquiry" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_home_v_version_lists_network_hubs" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"source" "enum__home_v_version_lists_network_hubs_source",
  	"_uuid" varchar
  );
  
  CREATE TABLE "_home_v_version_lists_network_hubs_locales" (
  	"n" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_home_v_version_lists_network_stats" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"source" "enum__home_v_version_lists_network_stats_source",
  	"_uuid" varchar
  );
  
  CREATE TABLE "_home_v_version_lists_network_stats_locales" (
  	"label" varchar,
  	"value" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  ALTER TABLE "home_lists_custom_steps_locales" ADD COLUMN "input" varchar;
  ALTER TABLE "home_lists_custom_steps_locales" ADD COLUMN "output" varchar;
  ALTER TABLE "_home_v_version_lists_custom_steps_locales" ADD COLUMN "input" varchar;
  ALTER TABLE "_home_v_version_lists_custom_steps_locales" ADD COLUMN "output" varchar;
  ALTER TABLE "home_lists_hero_facts" ADD CONSTRAINT "home_lists_hero_facts_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."home"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "home_lists_hero_facts_locales" ADD CONSTRAINT "home_lists_hero_facts_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."home_lists_hero_facts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "home_lists_families" ADD CONSTRAINT "home_lists_families_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."home"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "home_lists_families_locales" ADD CONSTRAINT "home_lists_families_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."home_lists_families"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "home_lists_network_hubs" ADD CONSTRAINT "home_lists_network_hubs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."home"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "home_lists_network_hubs_locales" ADD CONSTRAINT "home_lists_network_hubs_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."home_lists_network_hubs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "home_lists_network_stats" ADD CONSTRAINT "home_lists_network_stats_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."home"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "home_lists_network_stats_locales" ADD CONSTRAINT "home_lists_network_stats_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."home_lists_network_stats"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_home_v_version_lists_hero_facts" ADD CONSTRAINT "_home_v_version_lists_hero_facts_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_home_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_home_v_version_lists_hero_facts_locales" ADD CONSTRAINT "_home_v_version_lists_hero_facts_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_home_v_version_lists_hero_facts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_home_v_version_lists_families" ADD CONSTRAINT "_home_v_version_lists_families_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_home_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_home_v_version_lists_families_locales" ADD CONSTRAINT "_home_v_version_lists_families_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_home_v_version_lists_families"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_home_v_version_lists_network_hubs" ADD CONSTRAINT "_home_v_version_lists_network_hubs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_home_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_home_v_version_lists_network_hubs_locales" ADD CONSTRAINT "_home_v_version_lists_network_hubs_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_home_v_version_lists_network_hubs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_home_v_version_lists_network_stats" ADD CONSTRAINT "_home_v_version_lists_network_stats_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_home_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_home_v_version_lists_network_stats_locales" ADD CONSTRAINT "_home_v_version_lists_network_stats_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_home_v_version_lists_network_stats"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "home_lists_hero_facts_order_idx" ON "home_lists_hero_facts" USING btree ("_order");
  CREATE INDEX "home_lists_hero_facts_parent_id_idx" ON "home_lists_hero_facts" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "home_lists_hero_facts_locales_locale_parent_id_unique" ON "home_lists_hero_facts_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "home_lists_families_order_idx" ON "home_lists_families" USING btree ("_order");
  CREATE INDEX "home_lists_families_parent_id_idx" ON "home_lists_families" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "home_lists_families_locales_locale_parent_id_unique" ON "home_lists_families_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "home_lists_network_hubs_order_idx" ON "home_lists_network_hubs" USING btree ("_order");
  CREATE INDEX "home_lists_network_hubs_parent_id_idx" ON "home_lists_network_hubs" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "home_lists_network_hubs_locales_locale_parent_id_unique" ON "home_lists_network_hubs_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "home_lists_network_stats_order_idx" ON "home_lists_network_stats" USING btree ("_order");
  CREATE INDEX "home_lists_network_stats_parent_id_idx" ON "home_lists_network_stats" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "home_lists_network_stats_locales_locale_parent_id_unique" ON "home_lists_network_stats_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_home_v_version_lists_hero_facts_order_idx" ON "_home_v_version_lists_hero_facts" USING btree ("_order");
  CREATE INDEX "_home_v_version_lists_hero_facts_parent_id_idx" ON "_home_v_version_lists_hero_facts" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_home_v_version_lists_hero_facts_locales_locale_parent_id_un" ON "_home_v_version_lists_hero_facts_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_home_v_version_lists_families_order_idx" ON "_home_v_version_lists_families" USING btree ("_order");
  CREATE INDEX "_home_v_version_lists_families_parent_id_idx" ON "_home_v_version_lists_families" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_home_v_version_lists_families_locales_locale_parent_id_uniq" ON "_home_v_version_lists_families_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_home_v_version_lists_network_hubs_order_idx" ON "_home_v_version_lists_network_hubs" USING btree ("_order");
  CREATE INDEX "_home_v_version_lists_network_hubs_parent_id_idx" ON "_home_v_version_lists_network_hubs" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_home_v_version_lists_network_hubs_locales_locale_parent_id_" ON "_home_v_version_lists_network_hubs_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_home_v_version_lists_network_stats_order_idx" ON "_home_v_version_lists_network_stats" USING btree ("_order");
  CREATE INDEX "_home_v_version_lists_network_stats_parent_id_idx" ON "_home_v_version_lists_network_stats" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_home_v_version_lists_network_stats_locales_locale_parent_id" ON "_home_v_version_lists_network_stats_locales" USING btree ("_locale","_parent_id");`);

  /*
   * Carry today's values into content that already exists. Without this, a Home page published
   * before this migration would read the new lists as empty arrays, and an empty list renders as
   * "every row removed": the hero facts, the six product families and the export stats would
   * vanish from the live page until someone re-entered and re-published them.
   *
   * The values are a frozen copy of the STRUCTURAL_LISTS defaults on the day this migration was
   * written, deliberately inlined rather than imported, so a later edit to the defaults never
   * changes what this migration did. Every statement is guarded (NOT EXISTS / IS NULL), so it
   * never overwrites a row an editor has already saved. Only `en` is filled: it is the only locale
   * the content service reads (StructuralContentService returns nothing for fa/ar).
   */
  await db.execute(sql`
  WITH src (source, ord, label, value) AS (
    VALUES
      ('0', 1, 'Product families', '6'),
      ('1', 2, 'Customization steps', '6'),
      ('2', 3, 'Structured enquiry route', '1')
  ), ins AS (
    INSERT INTO "home_lists_hero_facts" ("_order", "_parent_id", "id", "source")
    SELECT s.ord, p.id, substr(md5('home_lists_hero_facts:' || s.source || ':' || p.id::text), 1, 24), s.source::"enum_home_lists_hero_facts_source"
    FROM "home" p CROSS JOIN src s
    WHERE NOT EXISTS (SELECT 1 FROM "home_lists_hero_facts" x WHERE x."_parent_id" = p.id)
    RETURNING "id", "_parent_id", "source"
  )
  INSERT INTO "home_lists_hero_facts_locales" ("label", "value", "_locale", "_parent_id")
  SELECT s."label", s."value", 'en', ins."id" FROM ins JOIN src s ON s.source = ins."source"::text;

  WITH src (source, ord, label, value) AS (
    VALUES
      ('0', 1, 'Product families', '6'),
      ('1', 2, 'Customization steps', '6'),
      ('2', 3, 'Structured enquiry route', '1')
  ), ins AS (
    INSERT INTO "_home_v_version_lists_hero_facts" ("_order", "_parent_id", "_uuid", "source")
    SELECT s.ord, p.id, substr(md5('home_lists_hero_facts:' || s.source || ':' || COALESCE((SELECT min("id") FROM "home"), 0)::text), 1, 24), s.source::"enum__home_v_version_lists_hero_facts_source"
    FROM "_home_v" p CROSS JOIN src s
    WHERE NOT EXISTS (SELECT 1 FROM "_home_v_version_lists_hero_facts" x WHERE x."_parent_id" = p.id)
    RETURNING "id", "_parent_id", "source"
  )
  INSERT INTO "_home_v_version_lists_hero_facts_locales" ("label", "value", "_locale", "_parent_id")
  SELECT s."label", s."value", 'en', ins."id" FROM ins JOIN src s ON s.source = ins."source"::text;

  WITH src (source, ord, name, short, sub, body, supplied, enquiry) AS (
    VALUES
      ('0', 1, 'Base Oils', 'Base Oils', 'Blending base stock', 'Refined base fractions supplied to lubricant manufacturers and blenders, and used as the starting point for the formulations below.', 'Bulk and flexitank', 'Grade, volume, destination'),
      ('1', 2, 'Lubricant Additives & Components', 'Additives', 'Performance components', 'Additive components and packages for blenders formulating their own products, selected against the performance the finished lubricant has to reach.', 'Drum and IBC', 'Application and target property'),
      ('2', 3, 'Engine Oils & Automotive Lubricants', 'Engine Oils', 'Engine, transmission and driveline', 'Finished lubricants for road transport and vehicle fleets, covering engine, transmission and driveline applications across viscosity grades.', '1 L to 208 L, and bulk', 'Equipment and operating conditions'),
      ('3', 4, 'Industrial Oils & Lubricants', 'Industrial', 'Plant, hydraulics and gearing', 'Hydraulic, gear, compressor and process fluids for manufacturing plant, chosen against the duty the equipment runs at rather than by name alone.', 'Drum, IBC and bulk', 'Equipment, duty and volume'),
      ('4', 5, 'Marine Oils & Lubricants', 'Marine', 'Vessel engines and systems', 'Lubricants for marine engines and onboard systems, supplied against the vessel''s requirement and the port the delivery has to reach.', 'Drum and bulk', 'Vessel, system and port'),
      ('5', 6, 'Antifreeze & Coolants', 'Coolants', 'Thermal management', 'Antifreeze and coolant products for automotive and industrial cooling systems, supplied as concentrate or ready-to-use according to the requirement.', 'Concentrate or ready-to-use', 'System, climate and volume')
  ), ins AS (
    INSERT INTO "home_lists_families" ("_order", "_parent_id", "id", "source")
    SELECT s.ord, p.id, substr(md5('home_lists_families:' || s.source || ':' || p.id::text), 1, 24), s.source::"enum_home_lists_families_source"
    FROM "home" p CROSS JOIN src s
    WHERE NOT EXISTS (SELECT 1 FROM "home_lists_families" x WHERE x."_parent_id" = p.id)
    RETURNING "id", "_parent_id", "source"
  )
  INSERT INTO "home_lists_families_locales" ("name", "short", "sub", "body", "supplied", "enquiry", "_locale", "_parent_id")
  SELECT s."name", s."short", s."sub", s."body", s."supplied", s."enquiry", 'en', ins."id" FROM ins JOIN src s ON s.source = ins."source"::text;

  WITH src (source, ord, name, short, sub, body, supplied, enquiry) AS (
    VALUES
      ('0', 1, 'Base Oils', 'Base Oils', 'Blending base stock', 'Refined base fractions supplied to lubricant manufacturers and blenders, and used as the starting point for the formulations below.', 'Bulk and flexitank', 'Grade, volume, destination'),
      ('1', 2, 'Lubricant Additives & Components', 'Additives', 'Performance components', 'Additive components and packages for blenders formulating their own products, selected against the performance the finished lubricant has to reach.', 'Drum and IBC', 'Application and target property'),
      ('2', 3, 'Engine Oils & Automotive Lubricants', 'Engine Oils', 'Engine, transmission and driveline', 'Finished lubricants for road transport and vehicle fleets, covering engine, transmission and driveline applications across viscosity grades.', '1 L to 208 L, and bulk', 'Equipment and operating conditions'),
      ('3', 4, 'Industrial Oils & Lubricants', 'Industrial', 'Plant, hydraulics and gearing', 'Hydraulic, gear, compressor and process fluids for manufacturing plant, chosen against the duty the equipment runs at rather than by name alone.', 'Drum, IBC and bulk', 'Equipment, duty and volume'),
      ('4', 5, 'Marine Oils & Lubricants', 'Marine', 'Vessel engines and systems', 'Lubricants for marine engines and onboard systems, supplied against the vessel''s requirement and the port the delivery has to reach.', 'Drum and bulk', 'Vessel, system and port'),
      ('5', 6, 'Antifreeze & Coolants', 'Coolants', 'Thermal management', 'Antifreeze and coolant products for automotive and industrial cooling systems, supplied as concentrate or ready-to-use according to the requirement.', 'Concentrate or ready-to-use', 'System, climate and volume')
  ), ins AS (
    INSERT INTO "_home_v_version_lists_families" ("_order", "_parent_id", "_uuid", "source")
    SELECT s.ord, p.id, substr(md5('home_lists_families:' || s.source || ':' || COALESCE((SELECT min("id") FROM "home"), 0)::text), 1, 24), s.source::"enum__home_v_version_lists_families_source"
    FROM "_home_v" p CROSS JOIN src s
    WHERE NOT EXISTS (SELECT 1 FROM "_home_v_version_lists_families" x WHERE x."_parent_id" = p.id)
    RETURNING "id", "_parent_id", "source"
  )
  INSERT INTO "_home_v_version_lists_families_locales" ("name", "short", "sub", "body", "supplied", "enquiry", "_locale", "_parent_id")
  SELECT s."name", s."short", s."sub", s."body", s."supplied", s."enquiry", 'en', ins."id" FROM ins JOIN src s ON s.source = ins."source"::text;

  WITH src (source, ord, n) AS (
    VALUES
      ('0', 1, 'Türkiye'),
      ('1', 2, 'Countries around India'),
      ('2', 3, 'North Africa'),
      ('3', 4, 'West Africa'),
      ('4', 5, 'East Africa'),
      ('5', 6, 'Southern Africa')
  ), ins AS (
    INSERT INTO "home_lists_network_hubs" ("_order", "_parent_id", "id", "source")
    SELECT s.ord, p.id, substr(md5('home_lists_network_hubs:' || s.source || ':' || p.id::text), 1, 24), s.source::"enum_home_lists_network_hubs_source"
    FROM "home" p CROSS JOIN src s
    WHERE NOT EXISTS (SELECT 1 FROM "home_lists_network_hubs" x WHERE x."_parent_id" = p.id)
    RETURNING "id", "_parent_id", "source"
  )
  INSERT INTO "home_lists_network_hubs_locales" ("n", "_locale", "_parent_id")
  SELECT s."n", 'en', ins."id" FROM ins JOIN src s ON s.source = ins."source"::text;

  WITH src (source, ord, n) AS (
    VALUES
      ('0', 1, 'Türkiye'),
      ('1', 2, 'Countries around India'),
      ('2', 3, 'North Africa'),
      ('3', 4, 'West Africa'),
      ('4', 5, 'East Africa'),
      ('5', 6, 'Southern Africa')
  ), ins AS (
    INSERT INTO "_home_v_version_lists_network_hubs" ("_order", "_parent_id", "_uuid", "source")
    SELECT s.ord, p.id, substr(md5('home_lists_network_hubs:' || s.source || ':' || COALESCE((SELECT min("id") FROM "home"), 0)::text), 1, 24), s.source::"enum__home_v_version_lists_network_hubs_source"
    FROM "_home_v" p CROSS JOIN src s
    WHERE NOT EXISTS (SELECT 1 FROM "_home_v_version_lists_network_hubs" x WHERE x."_parent_id" = p.id)
    RETURNING "id", "_parent_id", "source"
  )
  INSERT INTO "_home_v_version_lists_network_hubs_locales" ("n", "_locale", "_parent_id")
  SELECT s."n", 'en', ins."id" FROM ins JOIN src s ON s.source = ins."source"::text;

  WITH src (source, ord, label, value) AS (
    VALUES
      ('0', 1, 'Named Incoterms', '4'),
      ('1', 2, 'Packaging formats', '6'),
      ('2', 3, 'Export enquiry path', '1')
  ), ins AS (
    INSERT INTO "home_lists_network_stats" ("_order", "_parent_id", "id", "source")
    SELECT s.ord, p.id, substr(md5('home_lists_network_stats:' || s.source || ':' || p.id::text), 1, 24), s.source::"enum_home_lists_network_stats_source"
    FROM "home" p CROSS JOIN src s
    WHERE NOT EXISTS (SELECT 1 FROM "home_lists_network_stats" x WHERE x."_parent_id" = p.id)
    RETURNING "id", "_parent_id", "source"
  )
  INSERT INTO "home_lists_network_stats_locales" ("label", "value", "_locale", "_parent_id")
  SELECT s."label", s."value", 'en', ins."id" FROM ins JOIN src s ON s.source = ins."source"::text;

  WITH src (source, ord, label, value) AS (
    VALUES
      ('0', 1, 'Named Incoterms', '4'),
      ('1', 2, 'Packaging formats', '6'),
      ('2', 3, 'Export enquiry path', '1')
  ), ins AS (
    INSERT INTO "_home_v_version_lists_network_stats" ("_order", "_parent_id", "_uuid", "source")
    SELECT s.ord, p.id, substr(md5('home_lists_network_stats:' || s.source || ':' || COALESCE((SELECT min("id") FROM "home"), 0)::text), 1, 24), s.source::"enum__home_v_version_lists_network_stats_source"
    FROM "_home_v" p CROSS JOIN src s
    WHERE NOT EXISTS (SELECT 1 FROM "_home_v_version_lists_network_stats" x WHERE x."_parent_id" = p.id)
    RETURNING "id", "_parent_id", "source"
  )
  INSERT INTO "_home_v_version_lists_network_stats_locales" ("label", "value", "_locale", "_parent_id")
  SELECT s."label", s."value", 'en', ins."id" FROM ins JOIN src s ON s.source = ins."source"::text;

  UPDATE "home_lists_custom_steps_locales" l SET "input" = s.input, "output" = s.output
  FROM "home_lists_custom_steps" r, (VALUES
      ('0', 'Application and duty', 'Stated requirement'),
      ('1', 'Stated requirement', 'Candidate formulation'),
      ('2', 'Candidate formulation', 'Measured result'),
      ('3', 'Sample and result', 'Customer approval'),
      ('4', 'Approved formulation', 'Produced batch'),
      ('5', 'Produced batch', 'Delivered order')
  ) AS s (source, input, output)
  WHERE l."_parent_id" = r."id" AND r."source"::text = s.source AND l."_locale" = 'en' AND l."input" IS NULL AND l."output" IS NULL;

  UPDATE "_home_v_version_lists_custom_steps_locales" l SET "input" = s.input, "output" = s.output
  FROM "_home_v_version_lists_custom_steps" r, (VALUES
      ('0', 'Application and duty', 'Stated requirement'),
      ('1', 'Stated requirement', 'Candidate formulation'),
      ('2', 'Candidate formulation', 'Measured result'),
      ('3', 'Sample and result', 'Customer approval'),
      ('4', 'Approved formulation', 'Produced batch'),
      ('5', 'Produced batch', 'Delivered order')
  ) AS s (source, input, output)
  WHERE l."_parent_id" = r."id" AND r."source"::text = s.source AND l."_locale" = 'en' AND l."input" IS NULL AND l."output" IS NULL;`);
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "home_lists_hero_facts" CASCADE;
  DROP TABLE "home_lists_hero_facts_locales" CASCADE;
  DROP TABLE "home_lists_families" CASCADE;
  DROP TABLE "home_lists_families_locales" CASCADE;
  DROP TABLE "home_lists_network_hubs" CASCADE;
  DROP TABLE "home_lists_network_hubs_locales" CASCADE;
  DROP TABLE "home_lists_network_stats" CASCADE;
  DROP TABLE "home_lists_network_stats_locales" CASCADE;
  DROP TABLE "_home_v_version_lists_hero_facts" CASCADE;
  DROP TABLE "_home_v_version_lists_hero_facts_locales" CASCADE;
  DROP TABLE "_home_v_version_lists_families" CASCADE;
  DROP TABLE "_home_v_version_lists_families_locales" CASCADE;
  DROP TABLE "_home_v_version_lists_network_hubs" CASCADE;
  DROP TABLE "_home_v_version_lists_network_hubs_locales" CASCADE;
  DROP TABLE "_home_v_version_lists_network_stats" CASCADE;
  DROP TABLE "_home_v_version_lists_network_stats_locales" CASCADE;
  ALTER TABLE "home_lists_custom_steps_locales" DROP COLUMN "input";
  ALTER TABLE "home_lists_custom_steps_locales" DROP COLUMN "output";
  ALTER TABLE "_home_v_version_lists_custom_steps_locales" DROP COLUMN "input";
  ALTER TABLE "_home_v_version_lists_custom_steps_locales" DROP COLUMN "output";
  DROP TYPE "public"."enum_home_lists_hero_facts_source";
  DROP TYPE "public"."enum_home_lists_families_source";
  DROP TYPE "public"."enum_home_lists_network_hubs_source";
  DROP TYPE "public"."enum_home_lists_network_stats_source";
  DROP TYPE "public"."enum__home_v_version_lists_hero_facts_source";
  DROP TYPE "public"."enum__home_v_version_lists_families_source";
  DROP TYPE "public"."enum__home_v_version_lists_network_hubs_source";
  DROP TYPE "public"."enum__home_v_version_lists_network_stats_source";`);
}
