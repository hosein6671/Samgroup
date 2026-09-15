import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres";

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."_locales" AS ENUM('en', 'fa', 'ar');
  CREATE TYPE "public"."enum_users_roles" AS ENUM('admin', 'content-manager', 'service');
  CREATE TYPE "public"."enum_pages_seo_twitter_card_type" AS ENUM('summary', 'summary_large_image');
  CREATE TYPE "public"."enum_pages_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__pages_v_version_seo_twitter_card_type" AS ENUM('summary', 'summary_large_image');
  CREATE TYPE "public"."enum__pages_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__pages_v_published_locale" AS ENUM('en', 'fa', 'ar');
  CREATE TYPE "public"."enum_editorial_events_action" AS ENUM('save-draft', 'publish');
  CREATE TYPE "public"."enum_product_category_content_category_key" AS ENUM('base-oils', 'engine-oils-automotive-lubricants', 'industrial-oils-lubricants', 'lubricant-additives', 'marine-oils-lubricants', 'antifreeze-coolants');
  CREATE TYPE "public"."enum_product_category_content_seo_twitter_card_type" AS ENUM('summary', 'summary_large_image');
  CREATE TYPE "public"."enum_product_category_content_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__product_category_content_v_version_category_key" AS ENUM('base-oils', 'engine-oils-automotive-lubricants', 'industrial-oils-lubricants', 'lubricant-additives', 'marine-oils-lubricants', 'antifreeze-coolants');
  CREATE TYPE "public"."enum__product_category_content_v_version_seo_twitter_card_type" AS ENUM('summary', 'summary_large_image');
  CREATE TYPE "public"."enum__product_category_content_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__product_category_content_v_published_locale" AS ENUM('en', 'fa', 'ar');
  CREATE TYPE "public"."enum_faq_entries_related_category_keys" AS ENUM('base-oils', 'engine-oils-automotive-lubricants', 'industrial-oils-lubricants', 'lubricant-additives', 'marine-oils-lubricants', 'antifreeze-coolants');
  CREATE TYPE "public"."enum_faq_entries_topic" AS ENUM('company', 'products', 'ordering', 'export', 'customization');
  CREATE TYPE "public"."enum_faq_entries_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__faq_entries_v_version_related_category_keys" AS ENUM('base-oils', 'engine-oils-automotive-lubricants', 'industrial-oils-lubricants', 'lubricant-additives', 'marine-oils-lubricants', 'antifreeze-coolants');
  CREATE TYPE "public"."enum__faq_entries_v_version_topic" AS ENUM('company', 'products', 'ordering', 'export', 'customization');
  CREATE TYPE "public"."enum__faq_entries_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__faq_entries_v_published_locale" AS ENUM('en', 'fa', 'ar');
  CREATE TYPE "public"."enum_about_us_expertise_items_icon" AS ENUM('product', 'application', 'blend', 'formulation', 'documentation', 'supply', 'processing');
  CREATE TYPE "public"."enum_about_us_competitive_advantages_items_icon" AS ENUM('manufacturer', 'customization', 'quality', 'supply', 'expertise', 'partnership');
  CREATE TYPE "public"."enum_about_us_closing_routes_route" AS ENUM('products', 'customized-solutions', 'quality-certifications', 'contact-us', 'request-a-quote');
  CREATE TYPE "public"."enum_about_us_hero_primary_cta_route" AS ENUM('products', 'customized-solutions', 'quality-certifications', 'contact-us', 'request-a-quote');
  CREATE TYPE "public"."enum_about_us_hero_secondary_cta_route" AS ENUM('products', 'customized-solutions', 'quality-certifications', 'contact-us', 'request-a-quote');
  CREATE TYPE "public"."enum_about_us_quality_standards_footnote_cta_route" AS ENUM('products', 'customized-solutions', 'quality-certifications', 'contact-us', 'request-a-quote');
  CREATE TYPE "public"."enum_about_us_closing_primary_cta_route" AS ENUM('products', 'customized-solutions', 'quality-certifications', 'contact-us', 'request-a-quote');
  CREATE TYPE "public"."enum_about_us_seo_twitter_card_type" AS ENUM('summary', 'summary_large_image');
  CREATE TYPE "public"."enum_about_us_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__about_us_v_version_expertise_items_icon" AS ENUM('product', 'application', 'blend', 'formulation', 'documentation', 'supply', 'processing');
  CREATE TYPE "public"."enum__about_us_v_version_competitive_advantages_items_icon" AS ENUM('manufacturer', 'customization', 'quality', 'supply', 'expertise', 'partnership');
  CREATE TYPE "public"."enum__about_us_v_version_closing_routes_route" AS ENUM('products', 'customized-solutions', 'quality-certifications', 'contact-us', 'request-a-quote');
  CREATE TYPE "public"."enum__about_us_v_version_hero_primary_cta_route" AS ENUM('products', 'customized-solutions', 'quality-certifications', 'contact-us', 'request-a-quote');
  CREATE TYPE "public"."enum__about_us_v_version_hero_secondary_cta_route" AS ENUM('products', 'customized-solutions', 'quality-certifications', 'contact-us', 'request-a-quote');
  CREATE TYPE "public"."enum__about_us_v_version_quality_standards_footnote_cta_route" AS ENUM('products', 'customized-solutions', 'quality-certifications', 'contact-us', 'request-a-quote');
  CREATE TYPE "public"."enum__about_us_v_version_closing_primary_cta_route" AS ENUM('products', 'customized-solutions', 'quality-certifications', 'contact-us', 'request-a-quote');
  CREATE TYPE "public"."enum__about_us_v_version_seo_twitter_card_type" AS ENUM('summary', 'summary_large_image');
  CREATE TYPE "public"."enum__about_us_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__about_us_v_published_locale" AS ENUM('en', 'fa', 'ar');
  CREATE TYPE "public"."enum_customized_solutions_hero_route_cta_route" AS ENUM('products', 'customized-solutions', 'quality-certifications', 'contact-us', 'request-a-quote');
  CREATE TYPE "public"."enum_customized_solutions_seo_twitter_card_type" AS ENUM('summary', 'summary_large_image');
  CREATE TYPE "public"."enum_customized_solutions_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__customized_solutions_v_version_hero_route_cta_route" AS ENUM('products', 'customized-solutions', 'quality-certifications', 'contact-us', 'request-a-quote');
  CREATE TYPE "public"."enum__customized_solutions_v_version_seo_twitter_card_type" AS ENUM('summary', 'summary_large_image');
  CREATE TYPE "public"."enum__customized_solutions_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__customized_solutions_v_published_locale" AS ENUM('en', 'fa', 'ar');
  CREATE TYPE "public"."enum_quality_sampling_families" AS ENUM('base-oils', 'lubricant-additives', 'engine-oils-automotive-lubricants', 'industrial-oils-lubricants', 'marine-oils-lubricants', 'antifreeze-coolants');
  CREATE TYPE "public"."enum_quality_closing_routes_route" AS ENUM('products', 'customized-solutions', 'quality-certifications', 'contact-us', 'request-a-quote');
  CREATE TYPE "public"."enum_quality_hero_primary_cta_route" AS ENUM('products', 'customized-solutions', 'quality-certifications', 'contact-us', 'request-a-quote');
  CREATE TYPE "public"."enum_quality_hero_secondary_cta_route" AS ENUM('products', 'customized-solutions', 'quality-certifications', 'contact-us', 'request-a-quote');
  CREATE TYPE "public"."enum_quality_closing_primary_cta_route" AS ENUM('products', 'customized-solutions', 'quality-certifications', 'contact-us', 'request-a-quote');
  CREATE TYPE "public"."enum_quality_seo_twitter_card_type" AS ENUM('summary', 'summary_large_image');
  CREATE TYPE "public"."enum_quality_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__quality_v_version_sampling_families" AS ENUM('base-oils', 'lubricant-additives', 'engine-oils-automotive-lubricants', 'industrial-oils-lubricants', 'marine-oils-lubricants', 'antifreeze-coolants');
  CREATE TYPE "public"."enum__quality_v_version_closing_routes_route" AS ENUM('products', 'customized-solutions', 'quality-certifications', 'contact-us', 'request-a-quote');
  CREATE TYPE "public"."enum__quality_v_version_hero_primary_cta_route" AS ENUM('products', 'customized-solutions', 'quality-certifications', 'contact-us', 'request-a-quote');
  CREATE TYPE "public"."enum__quality_v_version_hero_secondary_cta_route" AS ENUM('products', 'customized-solutions', 'quality-certifications', 'contact-us', 'request-a-quote');
  CREATE TYPE "public"."enum__quality_v_version_closing_primary_cta_route" AS ENUM('products', 'customized-solutions', 'quality-certifications', 'contact-us', 'request-a-quote');
  CREATE TYPE "public"."enum__quality_v_version_seo_twitter_card_type" AS ENUM('summary', 'summary_large_image');
  CREATE TYPE "public"."enum__quality_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__quality_v_published_locale" AS ENUM('en', 'fa', 'ar');
  CREATE TYPE "public"."enum_contact_us_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__contact_us_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__contact_us_v_published_locale" AS ENUM('en', 'fa', 'ar');
  CREATE TYPE "public"."enum_faq_page_seo_twitter_card_type" AS ENUM('summary', 'summary_large_image');
  CREATE TYPE "public"."enum_faq_page_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__faq_page_v_version_seo_twitter_card_type" AS ENUM('summary', 'summary_large_image');
  CREATE TYPE "public"."enum__faq_page_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__faq_page_v_published_locale" AS ENUM('en', 'fa', 'ar');
  CREATE TABLE "users_roles" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_users_roles",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"enable_a_p_i_key" boolean,
  	"api_key" varchar,
  	"api_key_index" varchar,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "pages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"slug" varchar,
  	"body_html" varchar,
  	"last_updated_date" timestamp(3) with time zone,
  	"seo_canonical_url" varchar,
  	"seo_twitter_card_type" "enum_pages_seo_twitter_card_type" DEFAULT 'summary_large_image',
  	"seo_robots_index" boolean DEFAULT true,
  	"seo_robots_follow" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_pages_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "pages_locales" (
  	"title" varchar,
  	"body" jsonb,
  	"seo_meta_title" varchar,
  	"seo_meta_description" varchar,
  	"seo_og_title" varchar,
  	"seo_og_description" varchar,
  	"seo_social_image_id" integer,
  	"seo_twitter_title" varchar,
  	"seo_twitter_description" varchar,
  	"seo_twitter_image_id" integer,
  	"seo_structured_data_override" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "pages_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar,
  	"locale" "_locales"
  );
  
  CREATE TABLE "_pages_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_slug" varchar,
  	"version_body_html" varchar,
  	"version_last_updated_date" timestamp(3) with time zone,
  	"version_seo_canonical_url" varchar,
  	"version_seo_twitter_card_type" "enum__pages_v_version_seo_twitter_card_type" DEFAULT 'summary_large_image',
  	"version_seo_robots_index" boolean DEFAULT true,
  	"version_seo_robots_follow" boolean DEFAULT true,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__pages_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "enum__pages_v_published_locale",
  	"latest" boolean
  );
  
  CREATE TABLE "_pages_v_locales" (
  	"version_title" varchar,
  	"version_body" jsonb,
  	"version_seo_meta_title" varchar,
  	"version_seo_meta_description" varchar,
  	"version_seo_og_title" varchar,
  	"version_seo_og_description" varchar,
  	"version_seo_social_image_id" integer,
  	"version_seo_twitter_title" varchar,
  	"version_seo_twitter_description" varchar,
  	"version_seo_twitter_image_id" integer,
  	"version_seo_structured_data_override" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_pages_v_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar,
  	"locale" "_locales"
  );
  
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"prefix" varchar DEFAULT 'cms',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "media_locales" (
  	"alt" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "editorial_events" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"operation_id" varchar NOT NULL,
  	"actor_id" varchar NOT NULL,
  	"resource" varchar NOT NULL,
  	"action" "enum_editorial_events_action" NOT NULL,
  	"request_hash" varchar NOT NULL,
  	"revision" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "product_category_content_application_notes" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"description" varchar
  );
  
  CREATE TABLE "product_category_content" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"category_key" "enum_product_category_content_category_key",
  	"seo_canonical_url" varchar,
  	"seo_twitter_card_type" "enum_product_category_content_seo_twitter_card_type" DEFAULT 'summary_large_image',
  	"seo_robots_index" boolean DEFAULT true,
  	"seo_robots_follow" boolean DEFAULT true,
  	"use_shared_faq" boolean DEFAULT false,
  	"use_editorial_applications" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_product_category_content_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "product_category_content_locales" (
  	"hero_title" varchar,
  	"hero_supporting_text" varchar,
  	"overview_heading" varchar,
  	"overview_text" varchar,
  	"quality_heading" varchar,
  	"quality_intro" varchar,
  	"supply_heading" varchar,
  	"packaging_supply_text" varchar,
  	"supply_terms" varchar,
  	"documentation_heading" varchar,
  	"documentation_intro" varchar,
  	"documentation_note" varchar,
  	"seo_meta_title" varchar,
  	"seo_meta_description" varchar,
  	"seo_og_title" varchar,
  	"seo_og_description" varchar,
  	"seo_twitter_title" varchar,
  	"seo_twitter_description" varchar,
  	"applications_heading" varchar,
  	"applications_intro" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "product_category_content_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar,
  	"locale" "_locales"
  );
  
  CREATE TABLE "_product_category_content_v_version_application_notes" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"description" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_product_category_content_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_category_key" "enum__product_category_content_v_version_category_key",
  	"version_seo_canonical_url" varchar,
  	"version_seo_twitter_card_type" "enum__product_category_content_v_version_seo_twitter_card_type" DEFAULT 'summary_large_image',
  	"version_seo_robots_index" boolean DEFAULT true,
  	"version_seo_robots_follow" boolean DEFAULT true,
  	"version_use_shared_faq" boolean DEFAULT false,
  	"version_use_editorial_applications" boolean DEFAULT false,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__product_category_content_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "enum__product_category_content_v_published_locale",
  	"latest" boolean
  );
  
  CREATE TABLE "_product_category_content_v_locales" (
  	"version_hero_title" varchar,
  	"version_hero_supporting_text" varchar,
  	"version_overview_heading" varchar,
  	"version_overview_text" varchar,
  	"version_quality_heading" varchar,
  	"version_quality_intro" varchar,
  	"version_supply_heading" varchar,
  	"version_packaging_supply_text" varchar,
  	"version_supply_terms" varchar,
  	"version_documentation_heading" varchar,
  	"version_documentation_intro" varchar,
  	"version_documentation_note" varchar,
  	"version_seo_meta_title" varchar,
  	"version_seo_meta_description" varchar,
  	"version_seo_og_title" varchar,
  	"version_seo_og_description" varchar,
  	"version_seo_twitter_title" varchar,
  	"version_seo_twitter_description" varchar,
  	"version_applications_heading" varchar,
  	"version_applications_intro" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_product_category_content_v_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar,
  	"locale" "_locales"
  );
  
  CREATE TABLE "faq_entries_related_category_keys" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_faq_entries_related_category_keys",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "faq_entries" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"entry_key" varchar,
  	"topic" "enum_faq_entries_topic" DEFAULT 'products',
  	"show_on_contact_page" boolean DEFAULT false,
  	"sort_order" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_faq_entries_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "faq_entries_locales" (
  	"question" varchar,
  	"answer" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_faq_entries_v_version_related_category_keys" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum__faq_entries_v_version_related_category_keys",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "_faq_entries_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_entry_key" varchar,
  	"version_topic" "enum__faq_entries_v_version_topic" DEFAULT 'products',
  	"version_show_on_contact_page" boolean DEFAULT false,
  	"version_sort_order" numeric DEFAULT 0,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__faq_entries_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "enum__faq_entries_v_published_locale",
  	"latest" boolean
  );
  
  CREATE TABLE "_faq_entries_v_locales" (
  	"version_question" varchar,
  	"version_answer" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"pages_id" integer,
  	"media_id" integer,
  	"editorial_events_id" integer,
  	"product_category_content_id" integer,
  	"faq_entries_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "about_us_who_we_are_positions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "about_us_who_we_are_positions_locales" (
  	"term" varchar,
  	"note" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "about_us_expertise_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"icon" "enum_about_us_expertise_items_icon"
  );
  
  CREATE TABLE "about_us_expertise_items_locales" (
  	"name" varchar,
  	"note" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "about_us_competitive_advantages_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"icon" "enum_about_us_competitive_advantages_items_icon"
  );
  
  CREATE TABLE "about_us_competitive_advantages_items_locales" (
  	"name" varchar,
  	"note" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "about_us_team_functions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "about_us_team_functions_locales" (
  	"name" varchar,
  	"note" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "about_us_quality_standards_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "about_us_quality_standards_items_locales" (
  	"name" varchar,
  	"note" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "about_us_closing_routes" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"route" "enum_about_us_closing_routes_route"
  );
  
  CREATE TABLE "about_us_closing_routes_locales" (
  	"label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "about_us" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"hero_primary_cta_route" "enum_about_us_hero_primary_cta_route",
  	"hero_secondary_cta_route" "enum_about_us_hero_secondary_cta_route",
  	"hero_image_id" integer,
  	"who_we_are_body_html" varchar,
  	"who_we_are_image_id" integer,
  	"team_image_id" integer,
  	"quality_standards_footnote_cta_route" "enum_about_us_quality_standards_footnote_cta_route",
  	"quality_standards_image_id" integer,
  	"closing_primary_cta_route" "enum_about_us_closing_primary_cta_route",
  	"seo_canonical_url" varchar,
  	"seo_twitter_card_type" "enum_about_us_seo_twitter_card_type" DEFAULT 'summary_large_image',
  	"seo_robots_index" boolean DEFAULT true,
  	"seo_robots_follow" boolean DEFAULT true,
  	"_status" "enum_about_us_status" DEFAULT 'draft',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "about_us_locales" (
  	"hero_eyebrow" varchar,
  	"hero_title" varchar,
  	"hero_supporting_text" varchar,
  	"hero_primary_cta_label" varchar,
  	"hero_secondary_cta_label" varchar,
  	"hero_image_caption" varchar,
  	"who_we_are_heading" varchar,
  	"who_we_are_body" jsonb,
  	"who_we_are_image_caption" varchar,
  	"expertise_heading" varchar,
  	"expertise_lead" varchar,
  	"competitive_advantages_heading" varchar,
  	"competitive_advantages_lead" varchar,
  	"team_eyebrow" varchar,
  	"team_heading" varchar,
  	"team_lead" varchar,
  	"team_image_caption" varchar,
  	"quality_standards_heading" varchar,
  	"quality_standards_lead" varchar,
  	"quality_standards_footnote" varchar,
  	"quality_standards_footnote_cta_label" varchar,
  	"quality_standards_image_caption" varchar,
  	"closing_eyebrow" varchar,
  	"closing_heading" varchar,
  	"closing_lead" varchar,
  	"closing_primary_cta_label" varchar,
  	"seo_meta_title" varchar,
  	"seo_meta_description" varchar,
  	"seo_og_title" varchar,
  	"seo_og_description" varchar,
  	"seo_social_image_id" integer,
  	"seo_twitter_title" varchar,
  	"seo_twitter_description" varchar,
  	"seo_twitter_image_id" integer,
  	"seo_structured_data_override" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "about_us_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar,
  	"locale" "_locales"
  );
  
  CREATE TABLE "_about_us_v_version_who_we_are_positions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_about_us_v_version_who_we_are_positions_locales" (
  	"term" varchar,
  	"note" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_about_us_v_version_expertise_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"icon" "enum__about_us_v_version_expertise_items_icon",
  	"_uuid" varchar
  );
  
  CREATE TABLE "_about_us_v_version_expertise_items_locales" (
  	"name" varchar,
  	"note" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_about_us_v_version_competitive_advantages_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"icon" "enum__about_us_v_version_competitive_advantages_items_icon",
  	"_uuid" varchar
  );
  
  CREATE TABLE "_about_us_v_version_competitive_advantages_items_locales" (
  	"name" varchar,
  	"note" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_about_us_v_version_team_functions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_about_us_v_version_team_functions_locales" (
  	"name" varchar,
  	"note" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_about_us_v_version_quality_standards_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_about_us_v_version_quality_standards_items_locales" (
  	"name" varchar,
  	"note" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_about_us_v_version_closing_routes" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"route" "enum__about_us_v_version_closing_routes_route",
  	"_uuid" varchar
  );
  
  CREATE TABLE "_about_us_v_version_closing_routes_locales" (
  	"label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_about_us_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version_hero_primary_cta_route" "enum__about_us_v_version_hero_primary_cta_route",
  	"version_hero_secondary_cta_route" "enum__about_us_v_version_hero_secondary_cta_route",
  	"version_hero_image_id" integer,
  	"version_who_we_are_body_html" varchar,
  	"version_who_we_are_image_id" integer,
  	"version_team_image_id" integer,
  	"version_quality_standards_footnote_cta_route" "enum__about_us_v_version_quality_standards_footnote_cta_route",
  	"version_quality_standards_image_id" integer,
  	"version_closing_primary_cta_route" "enum__about_us_v_version_closing_primary_cta_route",
  	"version_seo_canonical_url" varchar,
  	"version_seo_twitter_card_type" "enum__about_us_v_version_seo_twitter_card_type" DEFAULT 'summary_large_image',
  	"version_seo_robots_index" boolean DEFAULT true,
  	"version_seo_robots_follow" boolean DEFAULT true,
  	"version__status" "enum__about_us_v_version_status" DEFAULT 'draft',
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "enum__about_us_v_published_locale",
  	"latest" boolean
  );
  
  CREATE TABLE "_about_us_v_locales" (
  	"version_hero_eyebrow" varchar,
  	"version_hero_title" varchar,
  	"version_hero_supporting_text" varchar,
  	"version_hero_primary_cta_label" varchar,
  	"version_hero_secondary_cta_label" varchar,
  	"version_hero_image_caption" varchar,
  	"version_who_we_are_heading" varchar,
  	"version_who_we_are_body" jsonb,
  	"version_who_we_are_image_caption" varchar,
  	"version_expertise_heading" varchar,
  	"version_expertise_lead" varchar,
  	"version_competitive_advantages_heading" varchar,
  	"version_competitive_advantages_lead" varchar,
  	"version_team_eyebrow" varchar,
  	"version_team_heading" varchar,
  	"version_team_lead" varchar,
  	"version_team_image_caption" varchar,
  	"version_quality_standards_heading" varchar,
  	"version_quality_standards_lead" varchar,
  	"version_quality_standards_footnote" varchar,
  	"version_quality_standards_footnote_cta_label" varchar,
  	"version_quality_standards_image_caption" varchar,
  	"version_closing_eyebrow" varchar,
  	"version_closing_heading" varchar,
  	"version_closing_lead" varchar,
  	"version_closing_primary_cta_label" varchar,
  	"version_seo_meta_title" varchar,
  	"version_seo_meta_description" varchar,
  	"version_seo_og_title" varchar,
  	"version_seo_og_description" varchar,
  	"version_seo_social_image_id" integer,
  	"version_seo_twitter_title" varchar,
  	"version_seo_twitter_description" varchar,
  	"version_seo_twitter_image_id" integer,
  	"version_seo_structured_data_override" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_about_us_v_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar,
  	"locale" "_locales"
  );
  
  CREATE TABLE "customized_solutions_process_steps" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "customized_solutions_process_steps_locales" (
  	"name" varchar,
  	"description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "customized_solutions_what_can_we_customize" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"description" varchar
  );
  
  CREATE TABLE "customized_solutions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"hero_route_cta_route" "enum_customized_solutions_hero_route_cta_route",
  	"introduction_body_html" varchar,
  	"seo_canonical_url" varchar,
  	"seo_twitter_card_type" "enum_customized_solutions_seo_twitter_card_type" DEFAULT 'summary_large_image',
  	"seo_robots_index" boolean DEFAULT true,
  	"seo_robots_follow" boolean DEFAULT true,
  	"_status" "enum_customized_solutions_status" DEFAULT 'draft',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "customized_solutions_locales" (
  	"hero_eyebrow" varchar,
  	"hero_title" varchar,
  	"hero_supporting_text" varchar,
  	"hero_request_cta_label" varchar,
  	"hero_route_cta_label" varchar,
  	"introduction_heading" varchar,
  	"introduction_body" jsonb,
  	"process_heading" varchar,
  	"process_lead" varchar,
  	"seo_meta_title" varchar,
  	"seo_meta_description" varchar,
  	"seo_og_title" varchar,
  	"seo_og_description" varchar,
  	"seo_social_image_id" integer,
  	"seo_twitter_title" varchar,
  	"seo_twitter_description" varchar,
  	"seo_twitter_image_id" integer,
  	"seo_structured_data_override" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "customized_solutions_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar,
  	"locale" "_locales"
  );
  
  CREATE TABLE "_customized_solutions_v_version_process_steps" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_customized_solutions_v_version_process_steps_locales" (
  	"name" varchar,
  	"description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_customized_solutions_v_version_what_can_we_customize" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"description" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_customized_solutions_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version_hero_route_cta_route" "enum__customized_solutions_v_version_hero_route_cta_route",
  	"version_introduction_body_html" varchar,
  	"version_seo_canonical_url" varchar,
  	"version_seo_twitter_card_type" "enum__customized_solutions_v_version_seo_twitter_card_type" DEFAULT 'summary_large_image',
  	"version_seo_robots_index" boolean DEFAULT true,
  	"version_seo_robots_follow" boolean DEFAULT true,
  	"version__status" "enum__customized_solutions_v_version_status" DEFAULT 'draft',
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "enum__customized_solutions_v_published_locale",
  	"latest" boolean
  );
  
  CREATE TABLE "_customized_solutions_v_locales" (
  	"version_hero_eyebrow" varchar,
  	"version_hero_title" varchar,
  	"version_hero_supporting_text" varchar,
  	"version_hero_request_cta_label" varchar,
  	"version_hero_route_cta_label" varchar,
  	"version_introduction_heading" varchar,
  	"version_introduction_body" jsonb,
  	"version_process_heading" varchar,
  	"version_process_lead" varchar,
  	"version_seo_meta_title" varchar,
  	"version_seo_meta_description" varchar,
  	"version_seo_og_title" varchar,
  	"version_seo_og_description" varchar,
  	"version_seo_social_image_id" integer,
  	"version_seo_twitter_title" varchar,
  	"version_seo_twitter_description" varchar,
  	"version_seo_twitter_image_id" integer,
  	"version_seo_structured_data_override" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_customized_solutions_v_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar,
  	"locale" "_locales"
  );
  
  CREATE TABLE "quality_approach_stages" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "quality_approach_stages_locales" (
  	"name" varchar,
  	"when" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "quality_laboratory_properties" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "quality_laboratory_properties_locales" (
  	"name" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "quality_laboratory_unpublished" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "quality_laboratory_unpublished_locales" (
  	"name" varchar,
  	"why" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "quality_documentation_documents" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "quality_documentation_documents_locales" (
  	"name" varchar,
  	"scope" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "quality_sampling_families" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_quality_sampling_families",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "quality_closing_routes" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"route" "enum_quality_closing_routes_route"
  );
  
  CREATE TABLE "quality_closing_routes_locales" (
  	"label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "quality" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"hero_primary_cta_route" "enum_quality_hero_primary_cta_route",
  	"hero_secondary_cta_route" "enum_quality_hero_secondary_cta_route",
  	"laboratory_image_id" integer,
  	"closing_primary_cta_route" "enum_quality_closing_primary_cta_route",
  	"seo_canonical_url" varchar,
  	"seo_twitter_card_type" "enum_quality_seo_twitter_card_type" DEFAULT 'summary_large_image',
  	"seo_robots_index" boolean DEFAULT true,
  	"seo_robots_follow" boolean DEFAULT true,
  	"_status" "enum_quality_status" DEFAULT 'draft',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "quality_locales" (
  	"hero_eyebrow" varchar,
  	"hero_title" varchar,
  	"hero_supporting_text" varchar,
  	"hero_index_label" varchar,
  	"hero_primary_cta_label" varchar,
  	"hero_secondary_cta_label" varchar,
  	"approach_eyebrow" varchar,
  	"approach_heading" varchar,
  	"approach_lead" varchar,
  	"approach_footnote" varchar,
  	"laboratory_eyebrow" varchar,
  	"laboratory_heading" varchar,
  	"laboratory_lead" varchar,
  	"laboratory_register_label" varchar,
  	"laboratory_order_note" varchar,
  	"laboratory_unpublished_heading" varchar,
  	"laboratory_image_caption" varchar,
  	"certifications_eyebrow" varchar,
  	"certifications_heading" varchar,
  	"certifications_status" varchar,
  	"certifications_statement" varchar,
  	"certifications_note" varchar,
  	"documentation_eyebrow" varchar,
  	"documentation_heading" varchar,
  	"documentation_lead" varchar,
  	"documentation_register_label" varchar,
  	"documentation_note" varchar,
  	"sampling_eyebrow" varchar,
  	"sampling_statement" varchar,
  	"sampling_families_label" varchar,
  	"sampling_limit" varchar,
  	"closing_eyebrow" varchar,
  	"closing_heading" varchar,
  	"closing_lead" varchar,
  	"closing_primary_cta_label" varchar,
  	"seo_meta_title" varchar,
  	"seo_meta_description" varchar,
  	"seo_og_title" varchar,
  	"seo_og_description" varchar,
  	"seo_social_image_id" integer,
  	"seo_twitter_title" varchar,
  	"seo_twitter_description" varchar,
  	"seo_twitter_image_id" integer,
  	"seo_structured_data_override" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "quality_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar,
  	"locale" "_locales"
  );
  
  CREATE TABLE "_quality_v_version_approach_stages" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_quality_v_version_approach_stages_locales" (
  	"name" varchar,
  	"when" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_quality_v_version_laboratory_properties" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_quality_v_version_laboratory_properties_locales" (
  	"name" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_quality_v_version_laboratory_unpublished" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_quality_v_version_laboratory_unpublished_locales" (
  	"name" varchar,
  	"why" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_quality_v_version_documentation_documents" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_quality_v_version_documentation_documents_locales" (
  	"name" varchar,
  	"scope" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_quality_v_version_sampling_families" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum__quality_v_version_sampling_families",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "_quality_v_version_closing_routes" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"route" "enum__quality_v_version_closing_routes_route",
  	"_uuid" varchar
  );
  
  CREATE TABLE "_quality_v_version_closing_routes_locales" (
  	"label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_quality_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version_hero_primary_cta_route" "enum__quality_v_version_hero_primary_cta_route",
  	"version_hero_secondary_cta_route" "enum__quality_v_version_hero_secondary_cta_route",
  	"version_laboratory_image_id" integer,
  	"version_closing_primary_cta_route" "enum__quality_v_version_closing_primary_cta_route",
  	"version_seo_canonical_url" varchar,
  	"version_seo_twitter_card_type" "enum__quality_v_version_seo_twitter_card_type" DEFAULT 'summary_large_image',
  	"version_seo_robots_index" boolean DEFAULT true,
  	"version_seo_robots_follow" boolean DEFAULT true,
  	"version__status" "enum__quality_v_version_status" DEFAULT 'draft',
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "enum__quality_v_published_locale",
  	"latest" boolean
  );
  
  CREATE TABLE "_quality_v_locales" (
  	"version_hero_eyebrow" varchar,
  	"version_hero_title" varchar,
  	"version_hero_supporting_text" varchar,
  	"version_hero_index_label" varchar,
  	"version_hero_primary_cta_label" varchar,
  	"version_hero_secondary_cta_label" varchar,
  	"version_approach_eyebrow" varchar,
  	"version_approach_heading" varchar,
  	"version_approach_lead" varchar,
  	"version_approach_footnote" varchar,
  	"version_laboratory_eyebrow" varchar,
  	"version_laboratory_heading" varchar,
  	"version_laboratory_lead" varchar,
  	"version_laboratory_register_label" varchar,
  	"version_laboratory_order_note" varchar,
  	"version_laboratory_unpublished_heading" varchar,
  	"version_laboratory_image_caption" varchar,
  	"version_certifications_eyebrow" varchar,
  	"version_certifications_heading" varchar,
  	"version_certifications_status" varchar,
  	"version_certifications_statement" varchar,
  	"version_certifications_note" varchar,
  	"version_documentation_eyebrow" varchar,
  	"version_documentation_heading" varchar,
  	"version_documentation_lead" varchar,
  	"version_documentation_register_label" varchar,
  	"version_documentation_note" varchar,
  	"version_sampling_eyebrow" varchar,
  	"version_sampling_statement" varchar,
  	"version_sampling_families_label" varchar,
  	"version_sampling_limit" varchar,
  	"version_closing_eyebrow" varchar,
  	"version_closing_heading" varchar,
  	"version_closing_lead" varchar,
  	"version_closing_primary_cta_label" varchar,
  	"version_seo_meta_title" varchar,
  	"version_seo_meta_description" varchar,
  	"version_seo_og_title" varchar,
  	"version_seo_og_description" varchar,
  	"version_seo_social_image_id" integer,
  	"version_seo_twitter_title" varchar,
  	"version_seo_twitter_description" varchar,
  	"version_seo_twitter_image_id" integer,
  	"version_seo_structured_data_override" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_quality_v_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar,
  	"locale" "_locales"
  );
  
  CREATE TABLE "contact_us" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"main_phone" varchar,
  	"sales_phone" varchar,
  	"general_email" varchar,
  	"sales_email" varchar,
  	"whatsapp_url" varchar,
  	"linkedin_url" varchar,
  	"instagram_url" varchar,
  	"telegram_url" varchar,
  	"_status" "enum_contact_us_status" DEFAULT 'draft',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "contact_us_locales" (
  	"address" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_contact_us_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version_main_phone" varchar,
  	"version_sales_phone" varchar,
  	"version_general_email" varchar,
  	"version_sales_email" varchar,
  	"version_whatsapp_url" varchar,
  	"version_linkedin_url" varchar,
  	"version_instagram_url" varchar,
  	"version_telegram_url" varchar,
  	"version__status" "enum__contact_us_v_version_status" DEFAULT 'draft',
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "enum__contact_us_v_published_locale",
  	"latest" boolean
  );
  
  CREATE TABLE "_contact_us_v_locales" (
  	"version_address" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "faq_page" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"seo_canonical_url" varchar,
  	"seo_twitter_card_type" "enum_faq_page_seo_twitter_card_type" DEFAULT 'summary_large_image',
  	"seo_robots_index" boolean DEFAULT true,
  	"seo_robots_follow" boolean DEFAULT true,
  	"_status" "enum_faq_page_status" DEFAULT 'draft',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "faq_page_locales" (
  	"eyebrow" varchar,
  	"title" varchar,
  	"introduction" varchar,
  	"questions_heading" varchar,
  	"contact_heading" varchar,
  	"contact_text" varchar,
  	"contact_label" varchar,
  	"seo_meta_title" varchar,
  	"seo_meta_description" varchar,
  	"seo_og_title" varchar,
  	"seo_og_description" varchar,
  	"seo_twitter_title" varchar,
  	"seo_twitter_description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "faq_page_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar,
  	"locale" "_locales"
  );
  
  CREATE TABLE "_faq_page_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version_seo_canonical_url" varchar,
  	"version_seo_twitter_card_type" "enum__faq_page_v_version_seo_twitter_card_type" DEFAULT 'summary_large_image',
  	"version_seo_robots_index" boolean DEFAULT true,
  	"version_seo_robots_follow" boolean DEFAULT true,
  	"version__status" "enum__faq_page_v_version_status" DEFAULT 'draft',
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "enum__faq_page_v_published_locale",
  	"latest" boolean
  );
  
  CREATE TABLE "_faq_page_v_locales" (
  	"version_eyebrow" varchar,
  	"version_title" varchar,
  	"version_introduction" varchar,
  	"version_questions_heading" varchar,
  	"version_contact_heading" varchar,
  	"version_contact_text" varchar,
  	"version_contact_label" varchar,
  	"version_seo_meta_title" varchar,
  	"version_seo_meta_description" varchar,
  	"version_seo_og_title" varchar,
  	"version_seo_og_description" varchar,
  	"version_seo_twitter_title" varchar,
  	"version_seo_twitter_description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_faq_page_v_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar,
  	"locale" "_locales"
  );
  
  ALTER TABLE "users_roles" ADD CONSTRAINT "users_roles_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_locales" ADD CONSTRAINT "pages_locales_seo_social_image_id_media_id_fk" FOREIGN KEY ("seo_social_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_locales" ADD CONSTRAINT "pages_locales_seo_twitter_image_id_media_id_fk" FOREIGN KEY ("seo_twitter_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_locales" ADD CONSTRAINT "pages_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_texts" ADD CONSTRAINT "pages_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v" ADD CONSTRAINT "_pages_v_parent_id_pages_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_locales" ADD CONSTRAINT "_pages_v_locales_version_seo_social_image_id_media_id_fk" FOREIGN KEY ("version_seo_social_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_locales" ADD CONSTRAINT "_pages_v_locales_version_seo_twitter_image_id_media_id_fk" FOREIGN KEY ("version_seo_twitter_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_locales" ADD CONSTRAINT "_pages_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_texts" ADD CONSTRAINT "_pages_v_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "media_locales" ADD CONSTRAINT "media_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "product_category_content_application_notes" ADD CONSTRAINT "product_category_content_application_notes_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."product_category_content"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "product_category_content_locales" ADD CONSTRAINT "product_category_content_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."product_category_content"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "product_category_content_texts" ADD CONSTRAINT "product_category_content_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."product_category_content"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_product_category_content_v_version_application_notes" ADD CONSTRAINT "_product_category_content_v_version_application_notes_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_product_category_content_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_product_category_content_v" ADD CONSTRAINT "_product_category_content_v_parent_id_product_category_content_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."product_category_content"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_product_category_content_v_locales" ADD CONSTRAINT "_product_category_content_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_product_category_content_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_product_category_content_v_texts" ADD CONSTRAINT "_product_category_content_v_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_product_category_content_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "faq_entries_related_category_keys" ADD CONSTRAINT "faq_entries_related_category_keys_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."faq_entries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "faq_entries_locales" ADD CONSTRAINT "faq_entries_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."faq_entries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_faq_entries_v_version_related_category_keys" ADD CONSTRAINT "_faq_entries_v_version_related_category_keys_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_faq_entries_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_faq_entries_v" ADD CONSTRAINT "_faq_entries_v_parent_id_faq_entries_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."faq_entries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_faq_entries_v_locales" ADD CONSTRAINT "_faq_entries_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_faq_entries_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_pages_fk" FOREIGN KEY ("pages_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_editorial_events_fk" FOREIGN KEY ("editorial_events_id") REFERENCES "public"."editorial_events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_product_category_content_fk" FOREIGN KEY ("product_category_content_id") REFERENCES "public"."product_category_content"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_faq_entries_fk" FOREIGN KEY ("faq_entries_id") REFERENCES "public"."faq_entries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "about_us_who_we_are_positions" ADD CONSTRAINT "about_us_who_we_are_positions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."about_us"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "about_us_who_we_are_positions_locales" ADD CONSTRAINT "about_us_who_we_are_positions_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."about_us_who_we_are_positions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "about_us_expertise_items" ADD CONSTRAINT "about_us_expertise_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."about_us"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "about_us_expertise_items_locales" ADD CONSTRAINT "about_us_expertise_items_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."about_us_expertise_items"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "about_us_competitive_advantages_items" ADD CONSTRAINT "about_us_competitive_advantages_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."about_us"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "about_us_competitive_advantages_items_locales" ADD CONSTRAINT "about_us_competitive_advantages_items_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."about_us_competitive_advantages_items"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "about_us_team_functions" ADD CONSTRAINT "about_us_team_functions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."about_us"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "about_us_team_functions_locales" ADD CONSTRAINT "about_us_team_functions_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."about_us_team_functions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "about_us_quality_standards_items" ADD CONSTRAINT "about_us_quality_standards_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."about_us"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "about_us_quality_standards_items_locales" ADD CONSTRAINT "about_us_quality_standards_items_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."about_us_quality_standards_items"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "about_us_closing_routes" ADD CONSTRAINT "about_us_closing_routes_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."about_us"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "about_us_closing_routes_locales" ADD CONSTRAINT "about_us_closing_routes_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."about_us_closing_routes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "about_us" ADD CONSTRAINT "about_us_hero_image_id_media_id_fk" FOREIGN KEY ("hero_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "about_us" ADD CONSTRAINT "about_us_who_we_are_image_id_media_id_fk" FOREIGN KEY ("who_we_are_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "about_us" ADD CONSTRAINT "about_us_team_image_id_media_id_fk" FOREIGN KEY ("team_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "about_us" ADD CONSTRAINT "about_us_quality_standards_image_id_media_id_fk" FOREIGN KEY ("quality_standards_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "about_us_locales" ADD CONSTRAINT "about_us_locales_seo_social_image_id_media_id_fk" FOREIGN KEY ("seo_social_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "about_us_locales" ADD CONSTRAINT "about_us_locales_seo_twitter_image_id_media_id_fk" FOREIGN KEY ("seo_twitter_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "about_us_locales" ADD CONSTRAINT "about_us_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."about_us"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "about_us_texts" ADD CONSTRAINT "about_us_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."about_us"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_about_us_v_version_who_we_are_positions" ADD CONSTRAINT "_about_us_v_version_who_we_are_positions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_about_us_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_about_us_v_version_who_we_are_positions_locales" ADD CONSTRAINT "_about_us_v_version_who_we_are_positions_locales_parent_i_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_about_us_v_version_who_we_are_positions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_about_us_v_version_expertise_items" ADD CONSTRAINT "_about_us_v_version_expertise_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_about_us_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_about_us_v_version_expertise_items_locales" ADD CONSTRAINT "_about_us_v_version_expertise_items_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_about_us_v_version_expertise_items"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_about_us_v_version_competitive_advantages_items" ADD CONSTRAINT "_about_us_v_version_competitive_advantages_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_about_us_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_about_us_v_version_competitive_advantages_items_locales" ADD CONSTRAINT "_about_us_v_version_competitive_advantages_items_locales__fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_about_us_v_version_competitive_advantages_items"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_about_us_v_version_team_functions" ADD CONSTRAINT "_about_us_v_version_team_functions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_about_us_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_about_us_v_version_team_functions_locales" ADD CONSTRAINT "_about_us_v_version_team_functions_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_about_us_v_version_team_functions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_about_us_v_version_quality_standards_items" ADD CONSTRAINT "_about_us_v_version_quality_standards_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_about_us_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_about_us_v_version_quality_standards_items_locales" ADD CONSTRAINT "_about_us_v_version_quality_standards_items_locales_paren_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_about_us_v_version_quality_standards_items"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_about_us_v_version_closing_routes" ADD CONSTRAINT "_about_us_v_version_closing_routes_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_about_us_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_about_us_v_version_closing_routes_locales" ADD CONSTRAINT "_about_us_v_version_closing_routes_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_about_us_v_version_closing_routes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_about_us_v" ADD CONSTRAINT "_about_us_v_version_hero_image_id_media_id_fk" FOREIGN KEY ("version_hero_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_about_us_v" ADD CONSTRAINT "_about_us_v_version_who_we_are_image_id_media_id_fk" FOREIGN KEY ("version_who_we_are_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_about_us_v" ADD CONSTRAINT "_about_us_v_version_team_image_id_media_id_fk" FOREIGN KEY ("version_team_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_about_us_v" ADD CONSTRAINT "_about_us_v_version_quality_standards_image_id_media_id_fk" FOREIGN KEY ("version_quality_standards_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_about_us_v_locales" ADD CONSTRAINT "_about_us_v_locales_version_seo_social_image_id_media_id_fk" FOREIGN KEY ("version_seo_social_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_about_us_v_locales" ADD CONSTRAINT "_about_us_v_locales_version_seo_twitter_image_id_media_id_fk" FOREIGN KEY ("version_seo_twitter_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_about_us_v_locales" ADD CONSTRAINT "_about_us_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_about_us_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_about_us_v_texts" ADD CONSTRAINT "_about_us_v_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_about_us_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "customized_solutions_process_steps" ADD CONSTRAINT "customized_solutions_process_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."customized_solutions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "customized_solutions_process_steps_locales" ADD CONSTRAINT "customized_solutions_process_steps_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."customized_solutions_process_steps"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "customized_solutions_what_can_we_customize" ADD CONSTRAINT "customized_solutions_what_can_we_customize_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."customized_solutions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "customized_solutions_locales" ADD CONSTRAINT "customized_solutions_locales_seo_social_image_id_media_id_fk" FOREIGN KEY ("seo_social_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "customized_solutions_locales" ADD CONSTRAINT "customized_solutions_locales_seo_twitter_image_id_media_id_fk" FOREIGN KEY ("seo_twitter_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "customized_solutions_locales" ADD CONSTRAINT "customized_solutions_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."customized_solutions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "customized_solutions_texts" ADD CONSTRAINT "customized_solutions_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."customized_solutions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_customized_solutions_v_version_process_steps" ADD CONSTRAINT "_customized_solutions_v_version_process_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_customized_solutions_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_customized_solutions_v_version_process_steps_locales" ADD CONSTRAINT "_customized_solutions_v_version_process_steps_locales_par_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_customized_solutions_v_version_process_steps"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_customized_solutions_v_version_what_can_we_customize" ADD CONSTRAINT "_customized_solutions_v_version_what_can_we_customize_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_customized_solutions_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_customized_solutions_v_locales" ADD CONSTRAINT "_customized_solutions_v_locales_version_seo_social_image_id_media_id_fk" FOREIGN KEY ("version_seo_social_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_customized_solutions_v_locales" ADD CONSTRAINT "_customized_solutions_v_locales_version_seo_twitter_image_id_media_id_fk" FOREIGN KEY ("version_seo_twitter_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_customized_solutions_v_locales" ADD CONSTRAINT "_customized_solutions_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_customized_solutions_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_customized_solutions_v_texts" ADD CONSTRAINT "_customized_solutions_v_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_customized_solutions_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "quality_approach_stages" ADD CONSTRAINT "quality_approach_stages_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."quality"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "quality_approach_stages_locales" ADD CONSTRAINT "quality_approach_stages_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."quality_approach_stages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "quality_laboratory_properties" ADD CONSTRAINT "quality_laboratory_properties_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."quality"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "quality_laboratory_properties_locales" ADD CONSTRAINT "quality_laboratory_properties_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."quality_laboratory_properties"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "quality_laboratory_unpublished" ADD CONSTRAINT "quality_laboratory_unpublished_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."quality"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "quality_laboratory_unpublished_locales" ADD CONSTRAINT "quality_laboratory_unpublished_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."quality_laboratory_unpublished"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "quality_documentation_documents" ADD CONSTRAINT "quality_documentation_documents_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."quality"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "quality_documentation_documents_locales" ADD CONSTRAINT "quality_documentation_documents_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."quality_documentation_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "quality_sampling_families" ADD CONSTRAINT "quality_sampling_families_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."quality"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "quality_closing_routes" ADD CONSTRAINT "quality_closing_routes_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."quality"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "quality_closing_routes_locales" ADD CONSTRAINT "quality_closing_routes_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."quality_closing_routes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "quality" ADD CONSTRAINT "quality_laboratory_image_id_media_id_fk" FOREIGN KEY ("laboratory_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "quality_locales" ADD CONSTRAINT "quality_locales_seo_social_image_id_media_id_fk" FOREIGN KEY ("seo_social_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "quality_locales" ADD CONSTRAINT "quality_locales_seo_twitter_image_id_media_id_fk" FOREIGN KEY ("seo_twitter_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "quality_locales" ADD CONSTRAINT "quality_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."quality"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "quality_texts" ADD CONSTRAINT "quality_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."quality"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_quality_v_version_approach_stages" ADD CONSTRAINT "_quality_v_version_approach_stages_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_quality_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_quality_v_version_approach_stages_locales" ADD CONSTRAINT "_quality_v_version_approach_stages_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_quality_v_version_approach_stages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_quality_v_version_laboratory_properties" ADD CONSTRAINT "_quality_v_version_laboratory_properties_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_quality_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_quality_v_version_laboratory_properties_locales" ADD CONSTRAINT "_quality_v_version_laboratory_properties_locales_parent_i_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_quality_v_version_laboratory_properties"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_quality_v_version_laboratory_unpublished" ADD CONSTRAINT "_quality_v_version_laboratory_unpublished_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_quality_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_quality_v_version_laboratory_unpublished_locales" ADD CONSTRAINT "_quality_v_version_laboratory_unpublished_locales_parent__fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_quality_v_version_laboratory_unpublished"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_quality_v_version_documentation_documents" ADD CONSTRAINT "_quality_v_version_documentation_documents_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_quality_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_quality_v_version_documentation_documents_locales" ADD CONSTRAINT "_quality_v_version_documentation_documents_locales_parent_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_quality_v_version_documentation_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_quality_v_version_sampling_families" ADD CONSTRAINT "_quality_v_version_sampling_families_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_quality_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_quality_v_version_closing_routes" ADD CONSTRAINT "_quality_v_version_closing_routes_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_quality_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_quality_v_version_closing_routes_locales" ADD CONSTRAINT "_quality_v_version_closing_routes_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_quality_v_version_closing_routes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_quality_v" ADD CONSTRAINT "_quality_v_version_laboratory_image_id_media_id_fk" FOREIGN KEY ("version_laboratory_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_quality_v_locales" ADD CONSTRAINT "_quality_v_locales_version_seo_social_image_id_media_id_fk" FOREIGN KEY ("version_seo_social_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_quality_v_locales" ADD CONSTRAINT "_quality_v_locales_version_seo_twitter_image_id_media_id_fk" FOREIGN KEY ("version_seo_twitter_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_quality_v_locales" ADD CONSTRAINT "_quality_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_quality_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_quality_v_texts" ADD CONSTRAINT "_quality_v_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_quality_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "contact_us_locales" ADD CONSTRAINT "contact_us_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."contact_us"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_contact_us_v_locales" ADD CONSTRAINT "_contact_us_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_contact_us_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "faq_page_locales" ADD CONSTRAINT "faq_page_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."faq_page"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "faq_page_texts" ADD CONSTRAINT "faq_page_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."faq_page"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_faq_page_v_locales" ADD CONSTRAINT "_faq_page_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_faq_page_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_faq_page_v_texts" ADD CONSTRAINT "_faq_page_v_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_faq_page_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_roles_order_idx" ON "users_roles" USING btree ("order");
  CREATE INDEX "users_roles_parent_idx" ON "users_roles" USING btree ("parent_id");
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE UNIQUE INDEX "pages_slug_idx" ON "pages" USING btree ("slug");
  CREATE INDEX "pages_updated_at_idx" ON "pages" USING btree ("updated_at");
  CREATE INDEX "pages_created_at_idx" ON "pages" USING btree ("created_at");
  CREATE INDEX "pages__status_idx" ON "pages" USING btree ("_status");
  CREATE INDEX "pages_seo_seo_social_image_idx" ON "pages_locales" USING btree ("seo_social_image_id","_locale");
  CREATE INDEX "pages_seo_seo_twitter_image_idx" ON "pages_locales" USING btree ("seo_twitter_image_id","_locale");
  CREATE UNIQUE INDEX "pages_locales_locale_parent_id_unique" ON "pages_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "pages_texts_order_parent" ON "pages_texts" USING btree ("order","parent_id");
  CREATE INDEX "pages_texts_locale_parent" ON "pages_texts" USING btree ("locale","parent_id");
  CREATE INDEX "_pages_v_parent_idx" ON "_pages_v" USING btree ("parent_id");
  CREATE INDEX "_pages_v_version_version_slug_idx" ON "_pages_v" USING btree ("version_slug");
  CREATE INDEX "_pages_v_version_version_updated_at_idx" ON "_pages_v" USING btree ("version_updated_at");
  CREATE INDEX "_pages_v_version_version_created_at_idx" ON "_pages_v" USING btree ("version_created_at");
  CREATE INDEX "_pages_v_version_version__status_idx" ON "_pages_v" USING btree ("version__status");
  CREATE INDEX "_pages_v_created_at_idx" ON "_pages_v" USING btree ("created_at");
  CREATE INDEX "_pages_v_updated_at_idx" ON "_pages_v" USING btree ("updated_at");
  CREATE INDEX "_pages_v_snapshot_idx" ON "_pages_v" USING btree ("snapshot");
  CREATE INDEX "_pages_v_published_locale_idx" ON "_pages_v" USING btree ("published_locale");
  CREATE INDEX "_pages_v_latest_idx" ON "_pages_v" USING btree ("latest");
  CREATE INDEX "_pages_v_version_seo_version_seo_social_image_idx" ON "_pages_v_locales" USING btree ("version_seo_social_image_id","_locale");
  CREATE INDEX "_pages_v_version_seo_version_seo_twitter_image_idx" ON "_pages_v_locales" USING btree ("version_seo_twitter_image_id","_locale");
  CREATE UNIQUE INDEX "_pages_v_locales_locale_parent_id_unique" ON "_pages_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_pages_v_texts_order_parent" ON "_pages_v_texts" USING btree ("order","parent_id");
  CREATE INDEX "_pages_v_texts_locale_parent" ON "_pages_v_texts" USING btree ("locale","parent_id");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE UNIQUE INDEX "media_locales_locale_parent_id_unique" ON "media_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "editorial_events_operation_id_idx" ON "editorial_events" USING btree ("operation_id");
  CREATE INDEX "editorial_events_actor_id_idx" ON "editorial_events" USING btree ("actor_id");
  CREATE INDEX "editorial_events_resource_idx" ON "editorial_events" USING btree ("resource");
  CREATE INDEX "editorial_events_updated_at_idx" ON "editorial_events" USING btree ("updated_at");
  CREATE INDEX "editorial_events_created_at_idx" ON "editorial_events" USING btree ("created_at");
  CREATE INDEX "product_category_content_application_notes_order_idx" ON "product_category_content_application_notes" USING btree ("_order");
  CREATE INDEX "product_category_content_application_notes_parent_id_idx" ON "product_category_content_application_notes" USING btree ("_parent_id");
  CREATE INDEX "product_category_content_application_notes_locale_idx" ON "product_category_content_application_notes" USING btree ("_locale");
  CREATE UNIQUE INDEX "product_category_content_category_key_idx" ON "product_category_content" USING btree ("category_key");
  CREATE INDEX "product_category_content_updated_at_idx" ON "product_category_content" USING btree ("updated_at");
  CREATE INDEX "product_category_content_created_at_idx" ON "product_category_content" USING btree ("created_at");
  CREATE INDEX "product_category_content__status_idx" ON "product_category_content" USING btree ("_status");
  CREATE UNIQUE INDEX "product_category_content_locales_locale_parent_id_unique" ON "product_category_content_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "product_category_content_texts_order_parent" ON "product_category_content_texts" USING btree ("order","parent_id");
  CREATE INDEX "product_category_content_texts_locale_parent" ON "product_category_content_texts" USING btree ("locale","parent_id");
  CREATE INDEX "_product_category_content_v_version_application_notes_order_idx" ON "_product_category_content_v_version_application_notes" USING btree ("_order");
  CREATE INDEX "_product_category_content_v_version_application_notes_parent_id_idx" ON "_product_category_content_v_version_application_notes" USING btree ("_parent_id");
  CREATE INDEX "_product_category_content_v_version_application_notes_locale_idx" ON "_product_category_content_v_version_application_notes" USING btree ("_locale");
  CREATE INDEX "_product_category_content_v_parent_idx" ON "_product_category_content_v" USING btree ("parent_id");
  CREATE INDEX "_product_category_content_v_version_version_category_key_idx" ON "_product_category_content_v" USING btree ("version_category_key");
  CREATE INDEX "_product_category_content_v_version_version_updated_at_idx" ON "_product_category_content_v" USING btree ("version_updated_at");
  CREATE INDEX "_product_category_content_v_version_version_created_at_idx" ON "_product_category_content_v" USING btree ("version_created_at");
  CREATE INDEX "_product_category_content_v_version_version__status_idx" ON "_product_category_content_v" USING btree ("version__status");
  CREATE INDEX "_product_category_content_v_created_at_idx" ON "_product_category_content_v" USING btree ("created_at");
  CREATE INDEX "_product_category_content_v_updated_at_idx" ON "_product_category_content_v" USING btree ("updated_at");
  CREATE INDEX "_product_category_content_v_snapshot_idx" ON "_product_category_content_v" USING btree ("snapshot");
  CREATE INDEX "_product_category_content_v_published_locale_idx" ON "_product_category_content_v" USING btree ("published_locale");
  CREATE INDEX "_product_category_content_v_latest_idx" ON "_product_category_content_v" USING btree ("latest");
  CREATE UNIQUE INDEX "_product_category_content_v_locales_locale_parent_id_unique" ON "_product_category_content_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_product_category_content_v_texts_order_parent" ON "_product_category_content_v_texts" USING btree ("order","parent_id");
  CREATE INDEX "_product_category_content_v_texts_locale_parent" ON "_product_category_content_v_texts" USING btree ("locale","parent_id");
  CREATE INDEX "faq_entries_related_category_keys_order_idx" ON "faq_entries_related_category_keys" USING btree ("order");
  CREATE INDEX "faq_entries_related_category_keys_parent_idx" ON "faq_entries_related_category_keys" USING btree ("parent_id");
  CREATE UNIQUE INDEX "faq_entries_entry_key_idx" ON "faq_entries" USING btree ("entry_key");
  CREATE INDEX "faq_entries_updated_at_idx" ON "faq_entries" USING btree ("updated_at");
  CREATE INDEX "faq_entries_created_at_idx" ON "faq_entries" USING btree ("created_at");
  CREATE INDEX "faq_entries__status_idx" ON "faq_entries" USING btree ("_status");
  CREATE UNIQUE INDEX "faq_entries_locales_locale_parent_id_unique" ON "faq_entries_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_faq_entries_v_version_related_category_keys_order_idx" ON "_faq_entries_v_version_related_category_keys" USING btree ("order");
  CREATE INDEX "_faq_entries_v_version_related_category_keys_parent_idx" ON "_faq_entries_v_version_related_category_keys" USING btree ("parent_id");
  CREATE INDEX "_faq_entries_v_parent_idx" ON "_faq_entries_v" USING btree ("parent_id");
  CREATE INDEX "_faq_entries_v_version_version_entry_key_idx" ON "_faq_entries_v" USING btree ("version_entry_key");
  CREATE INDEX "_faq_entries_v_version_version_updated_at_idx" ON "_faq_entries_v" USING btree ("version_updated_at");
  CREATE INDEX "_faq_entries_v_version_version_created_at_idx" ON "_faq_entries_v" USING btree ("version_created_at");
  CREATE INDEX "_faq_entries_v_version_version__status_idx" ON "_faq_entries_v" USING btree ("version__status");
  CREATE INDEX "_faq_entries_v_created_at_idx" ON "_faq_entries_v" USING btree ("created_at");
  CREATE INDEX "_faq_entries_v_updated_at_idx" ON "_faq_entries_v" USING btree ("updated_at");
  CREATE INDEX "_faq_entries_v_snapshot_idx" ON "_faq_entries_v" USING btree ("snapshot");
  CREATE INDEX "_faq_entries_v_published_locale_idx" ON "_faq_entries_v" USING btree ("published_locale");
  CREATE INDEX "_faq_entries_v_latest_idx" ON "_faq_entries_v" USING btree ("latest");
  CREATE UNIQUE INDEX "_faq_entries_v_locales_locale_parent_id_unique" ON "_faq_entries_v_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_pages_id_idx" ON "payload_locked_documents_rels" USING btree ("pages_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_editorial_events_id_idx" ON "payload_locked_documents_rels" USING btree ("editorial_events_id");
  CREATE INDEX "payload_locked_documents_rels_product_category_content_i_idx" ON "payload_locked_documents_rels" USING btree ("product_category_content_id");
  CREATE INDEX "payload_locked_documents_rels_faq_entries_id_idx" ON "payload_locked_documents_rels" USING btree ("faq_entries_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");
  CREATE INDEX "about_us_who_we_are_positions_order_idx" ON "about_us_who_we_are_positions" USING btree ("_order");
  CREATE INDEX "about_us_who_we_are_positions_parent_id_idx" ON "about_us_who_we_are_positions" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "about_us_who_we_are_positions_locales_locale_parent_id_uniqu" ON "about_us_who_we_are_positions_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "about_us_expertise_items_order_idx" ON "about_us_expertise_items" USING btree ("_order");
  CREATE INDEX "about_us_expertise_items_parent_id_idx" ON "about_us_expertise_items" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "about_us_expertise_items_locales_locale_parent_id_unique" ON "about_us_expertise_items_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "about_us_competitive_advantages_items_order_idx" ON "about_us_competitive_advantages_items" USING btree ("_order");
  CREATE INDEX "about_us_competitive_advantages_items_parent_id_idx" ON "about_us_competitive_advantages_items" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "about_us_competitive_advantages_items_locales_locale_parent_" ON "about_us_competitive_advantages_items_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "about_us_team_functions_order_idx" ON "about_us_team_functions" USING btree ("_order");
  CREATE INDEX "about_us_team_functions_parent_id_idx" ON "about_us_team_functions" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "about_us_team_functions_locales_locale_parent_id_unique" ON "about_us_team_functions_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "about_us_quality_standards_items_order_idx" ON "about_us_quality_standards_items" USING btree ("_order");
  CREATE INDEX "about_us_quality_standards_items_parent_id_idx" ON "about_us_quality_standards_items" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "about_us_quality_standards_items_locales_locale_parent_id_un" ON "about_us_quality_standards_items_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "about_us_closing_routes_order_idx" ON "about_us_closing_routes" USING btree ("_order");
  CREATE INDEX "about_us_closing_routes_parent_id_idx" ON "about_us_closing_routes" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "about_us_closing_routes_locales_locale_parent_id_unique" ON "about_us_closing_routes_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "about_us_hero_hero_image_idx" ON "about_us" USING btree ("hero_image_id");
  CREATE INDEX "about_us_who_we_are_who_we_are_image_idx" ON "about_us" USING btree ("who_we_are_image_id");
  CREATE INDEX "about_us_team_team_image_idx" ON "about_us" USING btree ("team_image_id");
  CREATE INDEX "about_us_quality_standards_quality_standards_image_idx" ON "about_us" USING btree ("quality_standards_image_id");
  CREATE INDEX "about_us__status_idx" ON "about_us" USING btree ("_status");
  CREATE INDEX "about_us_seo_seo_social_image_idx" ON "about_us_locales" USING btree ("seo_social_image_id","_locale");
  CREATE INDEX "about_us_seo_seo_twitter_image_idx" ON "about_us_locales" USING btree ("seo_twitter_image_id","_locale");
  CREATE UNIQUE INDEX "about_us_locales_locale_parent_id_unique" ON "about_us_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "about_us_texts_order_parent" ON "about_us_texts" USING btree ("order","parent_id");
  CREATE INDEX "about_us_texts_locale_parent" ON "about_us_texts" USING btree ("locale","parent_id");
  CREATE INDEX "_about_us_v_version_who_we_are_positions_order_idx" ON "_about_us_v_version_who_we_are_positions" USING btree ("_order");
  CREATE INDEX "_about_us_v_version_who_we_are_positions_parent_id_idx" ON "_about_us_v_version_who_we_are_positions" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_about_us_v_version_who_we_are_positions_locales_locale_pare" ON "_about_us_v_version_who_we_are_positions_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_about_us_v_version_expertise_items_order_idx" ON "_about_us_v_version_expertise_items" USING btree ("_order");
  CREATE INDEX "_about_us_v_version_expertise_items_parent_id_idx" ON "_about_us_v_version_expertise_items" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_about_us_v_version_expertise_items_locales_locale_parent_id" ON "_about_us_v_version_expertise_items_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_about_us_v_version_competitive_advantages_items_order_idx" ON "_about_us_v_version_competitive_advantages_items" USING btree ("_order");
  CREATE INDEX "_about_us_v_version_competitive_advantages_items_parent_id_idx" ON "_about_us_v_version_competitive_advantages_items" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_about_us_v_version_competitive_advantages_items_locales_loc" ON "_about_us_v_version_competitive_advantages_items_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_about_us_v_version_team_functions_order_idx" ON "_about_us_v_version_team_functions" USING btree ("_order");
  CREATE INDEX "_about_us_v_version_team_functions_parent_id_idx" ON "_about_us_v_version_team_functions" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_about_us_v_version_team_functions_locales_locale_parent_id_" ON "_about_us_v_version_team_functions_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_about_us_v_version_quality_standards_items_order_idx" ON "_about_us_v_version_quality_standards_items" USING btree ("_order");
  CREATE INDEX "_about_us_v_version_quality_standards_items_parent_id_idx" ON "_about_us_v_version_quality_standards_items" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_about_us_v_version_quality_standards_items_locales_locale_p" ON "_about_us_v_version_quality_standards_items_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_about_us_v_version_closing_routes_order_idx" ON "_about_us_v_version_closing_routes" USING btree ("_order");
  CREATE INDEX "_about_us_v_version_closing_routes_parent_id_idx" ON "_about_us_v_version_closing_routes" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_about_us_v_version_closing_routes_locales_locale_parent_id_" ON "_about_us_v_version_closing_routes_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_about_us_v_version_hero_version_hero_image_idx" ON "_about_us_v" USING btree ("version_hero_image_id");
  CREATE INDEX "_about_us_v_version_who_we_are_version_who_we_are_image_idx" ON "_about_us_v" USING btree ("version_who_we_are_image_id");
  CREATE INDEX "_about_us_v_version_team_version_team_image_idx" ON "_about_us_v" USING btree ("version_team_image_id");
  CREATE INDEX "_about_us_v_version_quality_standards_version_quality_st_idx" ON "_about_us_v" USING btree ("version_quality_standards_image_id");
  CREATE INDEX "_about_us_v_version_version__status_idx" ON "_about_us_v" USING btree ("version__status");
  CREATE INDEX "_about_us_v_created_at_idx" ON "_about_us_v" USING btree ("created_at");
  CREATE INDEX "_about_us_v_updated_at_idx" ON "_about_us_v" USING btree ("updated_at");
  CREATE INDEX "_about_us_v_snapshot_idx" ON "_about_us_v" USING btree ("snapshot");
  CREATE INDEX "_about_us_v_published_locale_idx" ON "_about_us_v" USING btree ("published_locale");
  CREATE INDEX "_about_us_v_latest_idx" ON "_about_us_v" USING btree ("latest");
  CREATE INDEX "_about_us_v_version_seo_version_seo_social_image_idx" ON "_about_us_v_locales" USING btree ("version_seo_social_image_id","_locale");
  CREATE INDEX "_about_us_v_version_seo_version_seo_twitter_image_idx" ON "_about_us_v_locales" USING btree ("version_seo_twitter_image_id","_locale");
  CREATE UNIQUE INDEX "_about_us_v_locales_locale_parent_id_unique" ON "_about_us_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_about_us_v_texts_order_parent" ON "_about_us_v_texts" USING btree ("order","parent_id");
  CREATE INDEX "_about_us_v_texts_locale_parent" ON "_about_us_v_texts" USING btree ("locale","parent_id");
  CREATE INDEX "customized_solutions_process_steps_order_idx" ON "customized_solutions_process_steps" USING btree ("_order");
  CREATE INDEX "customized_solutions_process_steps_parent_id_idx" ON "customized_solutions_process_steps" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "customized_solutions_process_steps_locales_locale_parent_id_" ON "customized_solutions_process_steps_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "customized_solutions_what_can_we_customize_order_idx" ON "customized_solutions_what_can_we_customize" USING btree ("_order");
  CREATE INDEX "customized_solutions_what_can_we_customize_parent_id_idx" ON "customized_solutions_what_can_we_customize" USING btree ("_parent_id");
  CREATE INDEX "customized_solutions_what_can_we_customize_locale_idx" ON "customized_solutions_what_can_we_customize" USING btree ("_locale");
  CREATE INDEX "customized_solutions__status_idx" ON "customized_solutions" USING btree ("_status");
  CREATE INDEX "customized_solutions_seo_seo_social_image_idx" ON "customized_solutions_locales" USING btree ("seo_social_image_id","_locale");
  CREATE INDEX "customized_solutions_seo_seo_twitter_image_idx" ON "customized_solutions_locales" USING btree ("seo_twitter_image_id","_locale");
  CREATE UNIQUE INDEX "customized_solutions_locales_locale_parent_id_unique" ON "customized_solutions_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "customized_solutions_texts_order_parent" ON "customized_solutions_texts" USING btree ("order","parent_id");
  CREATE INDEX "customized_solutions_texts_locale_parent" ON "customized_solutions_texts" USING btree ("locale","parent_id");
  CREATE INDEX "_customized_solutions_v_version_process_steps_order_idx" ON "_customized_solutions_v_version_process_steps" USING btree ("_order");
  CREATE INDEX "_customized_solutions_v_version_process_steps_parent_id_idx" ON "_customized_solutions_v_version_process_steps" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_customized_solutions_v_version_process_steps_locales_locale" ON "_customized_solutions_v_version_process_steps_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_customized_solutions_v_version_what_can_we_customize_order_idx" ON "_customized_solutions_v_version_what_can_we_customize" USING btree ("_order");
  CREATE INDEX "_customized_solutions_v_version_what_can_we_customize_parent_id_idx" ON "_customized_solutions_v_version_what_can_we_customize" USING btree ("_parent_id");
  CREATE INDEX "_customized_solutions_v_version_what_can_we_customize_locale_idx" ON "_customized_solutions_v_version_what_can_we_customize" USING btree ("_locale");
  CREATE INDEX "_customized_solutions_v_version_version__status_idx" ON "_customized_solutions_v" USING btree ("version__status");
  CREATE INDEX "_customized_solutions_v_created_at_idx" ON "_customized_solutions_v" USING btree ("created_at");
  CREATE INDEX "_customized_solutions_v_updated_at_idx" ON "_customized_solutions_v" USING btree ("updated_at");
  CREATE INDEX "_customized_solutions_v_snapshot_idx" ON "_customized_solutions_v" USING btree ("snapshot");
  CREATE INDEX "_customized_solutions_v_published_locale_idx" ON "_customized_solutions_v" USING btree ("published_locale");
  CREATE INDEX "_customized_solutions_v_latest_idx" ON "_customized_solutions_v" USING btree ("latest");
  CREATE INDEX "_customized_solutions_v_version_seo_version_seo_social_i_idx" ON "_customized_solutions_v_locales" USING btree ("version_seo_social_image_id","_locale");
  CREATE INDEX "_customized_solutions_v_version_seo_version_seo_twitter__idx" ON "_customized_solutions_v_locales" USING btree ("version_seo_twitter_image_id","_locale");
  CREATE UNIQUE INDEX "_customized_solutions_v_locales_locale_parent_id_unique" ON "_customized_solutions_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_customized_solutions_v_texts_order_parent" ON "_customized_solutions_v_texts" USING btree ("order","parent_id");
  CREATE INDEX "_customized_solutions_v_texts_locale_parent" ON "_customized_solutions_v_texts" USING btree ("locale","parent_id");
  CREATE INDEX "quality_approach_stages_order_idx" ON "quality_approach_stages" USING btree ("_order");
  CREATE INDEX "quality_approach_stages_parent_id_idx" ON "quality_approach_stages" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "quality_approach_stages_locales_locale_parent_id_unique" ON "quality_approach_stages_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "quality_laboratory_properties_order_idx" ON "quality_laboratory_properties" USING btree ("_order");
  CREATE INDEX "quality_laboratory_properties_parent_id_idx" ON "quality_laboratory_properties" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "quality_laboratory_properties_locales_locale_parent_id_uniqu" ON "quality_laboratory_properties_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "quality_laboratory_unpublished_order_idx" ON "quality_laboratory_unpublished" USING btree ("_order");
  CREATE INDEX "quality_laboratory_unpublished_parent_id_idx" ON "quality_laboratory_unpublished" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "quality_laboratory_unpublished_locales_locale_parent_id_uniq" ON "quality_laboratory_unpublished_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "quality_documentation_documents_order_idx" ON "quality_documentation_documents" USING btree ("_order");
  CREATE INDEX "quality_documentation_documents_parent_id_idx" ON "quality_documentation_documents" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "quality_documentation_documents_locales_locale_parent_id_uni" ON "quality_documentation_documents_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "quality_sampling_families_order_idx" ON "quality_sampling_families" USING btree ("order");
  CREATE INDEX "quality_sampling_families_parent_idx" ON "quality_sampling_families" USING btree ("parent_id");
  CREATE INDEX "quality_closing_routes_order_idx" ON "quality_closing_routes" USING btree ("_order");
  CREATE INDEX "quality_closing_routes_parent_id_idx" ON "quality_closing_routes" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "quality_closing_routes_locales_locale_parent_id_unique" ON "quality_closing_routes_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "quality_laboratory_laboratory_image_idx" ON "quality" USING btree ("laboratory_image_id");
  CREATE INDEX "quality__status_idx" ON "quality" USING btree ("_status");
  CREATE INDEX "quality_seo_seo_social_image_idx" ON "quality_locales" USING btree ("seo_social_image_id","_locale");
  CREATE INDEX "quality_seo_seo_twitter_image_idx" ON "quality_locales" USING btree ("seo_twitter_image_id","_locale");
  CREATE UNIQUE INDEX "quality_locales_locale_parent_id_unique" ON "quality_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "quality_texts_order_parent" ON "quality_texts" USING btree ("order","parent_id");
  CREATE INDEX "quality_texts_locale_parent" ON "quality_texts" USING btree ("locale","parent_id");
  CREATE INDEX "_quality_v_version_approach_stages_order_idx" ON "_quality_v_version_approach_stages" USING btree ("_order");
  CREATE INDEX "_quality_v_version_approach_stages_parent_id_idx" ON "_quality_v_version_approach_stages" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_quality_v_version_approach_stages_locales_locale_parent_id_" ON "_quality_v_version_approach_stages_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_quality_v_version_laboratory_properties_order_idx" ON "_quality_v_version_laboratory_properties" USING btree ("_order");
  CREATE INDEX "_quality_v_version_laboratory_properties_parent_id_idx" ON "_quality_v_version_laboratory_properties" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_quality_v_version_laboratory_properties_locales_locale_pare" ON "_quality_v_version_laboratory_properties_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_quality_v_version_laboratory_unpublished_order_idx" ON "_quality_v_version_laboratory_unpublished" USING btree ("_order");
  CREATE INDEX "_quality_v_version_laboratory_unpublished_parent_id_idx" ON "_quality_v_version_laboratory_unpublished" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_quality_v_version_laboratory_unpublished_locales_locale_par" ON "_quality_v_version_laboratory_unpublished_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_quality_v_version_documentation_documents_order_idx" ON "_quality_v_version_documentation_documents" USING btree ("_order");
  CREATE INDEX "_quality_v_version_documentation_documents_parent_id_idx" ON "_quality_v_version_documentation_documents" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_quality_v_version_documentation_documents_locales_locale_pa" ON "_quality_v_version_documentation_documents_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_quality_v_version_sampling_families_order_idx" ON "_quality_v_version_sampling_families" USING btree ("order");
  CREATE INDEX "_quality_v_version_sampling_families_parent_idx" ON "_quality_v_version_sampling_families" USING btree ("parent_id");
  CREATE INDEX "_quality_v_version_closing_routes_order_idx" ON "_quality_v_version_closing_routes" USING btree ("_order");
  CREATE INDEX "_quality_v_version_closing_routes_parent_id_idx" ON "_quality_v_version_closing_routes" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_quality_v_version_closing_routes_locales_locale_parent_id_u" ON "_quality_v_version_closing_routes_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_quality_v_version_laboratory_version_laboratory_image_idx" ON "_quality_v" USING btree ("version_laboratory_image_id");
  CREATE INDEX "_quality_v_version_version__status_idx" ON "_quality_v" USING btree ("version__status");
  CREATE INDEX "_quality_v_created_at_idx" ON "_quality_v" USING btree ("created_at");
  CREATE INDEX "_quality_v_updated_at_idx" ON "_quality_v" USING btree ("updated_at");
  CREATE INDEX "_quality_v_snapshot_idx" ON "_quality_v" USING btree ("snapshot");
  CREATE INDEX "_quality_v_published_locale_idx" ON "_quality_v" USING btree ("published_locale");
  CREATE INDEX "_quality_v_latest_idx" ON "_quality_v" USING btree ("latest");
  CREATE INDEX "_quality_v_version_seo_version_seo_social_image_idx" ON "_quality_v_locales" USING btree ("version_seo_social_image_id","_locale");
  CREATE INDEX "_quality_v_version_seo_version_seo_twitter_image_idx" ON "_quality_v_locales" USING btree ("version_seo_twitter_image_id","_locale");
  CREATE UNIQUE INDEX "_quality_v_locales_locale_parent_id_unique" ON "_quality_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_quality_v_texts_order_parent" ON "_quality_v_texts" USING btree ("order","parent_id");
  CREATE INDEX "_quality_v_texts_locale_parent" ON "_quality_v_texts" USING btree ("locale","parent_id");
  CREATE INDEX "contact_us__status_idx" ON "contact_us" USING btree ("_status");
  CREATE UNIQUE INDEX "contact_us_locales_locale_parent_id_unique" ON "contact_us_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_contact_us_v_version_version__status_idx" ON "_contact_us_v" USING btree ("version__status");
  CREATE INDEX "_contact_us_v_created_at_idx" ON "_contact_us_v" USING btree ("created_at");
  CREATE INDEX "_contact_us_v_updated_at_idx" ON "_contact_us_v" USING btree ("updated_at");
  CREATE INDEX "_contact_us_v_snapshot_idx" ON "_contact_us_v" USING btree ("snapshot");
  CREATE INDEX "_contact_us_v_published_locale_idx" ON "_contact_us_v" USING btree ("published_locale");
  CREATE INDEX "_contact_us_v_latest_idx" ON "_contact_us_v" USING btree ("latest");
  CREATE UNIQUE INDEX "_contact_us_v_locales_locale_parent_id_unique" ON "_contact_us_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "faq_page__status_idx" ON "faq_page" USING btree ("_status");
  CREATE UNIQUE INDEX "faq_page_locales_locale_parent_id_unique" ON "faq_page_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "faq_page_texts_order_parent" ON "faq_page_texts" USING btree ("order","parent_id");
  CREATE INDEX "faq_page_texts_locale_parent" ON "faq_page_texts" USING btree ("locale","parent_id");
  CREATE INDEX "_faq_page_v_version_version__status_idx" ON "_faq_page_v" USING btree ("version__status");
  CREATE INDEX "_faq_page_v_created_at_idx" ON "_faq_page_v" USING btree ("created_at");
  CREATE INDEX "_faq_page_v_updated_at_idx" ON "_faq_page_v" USING btree ("updated_at");
  CREATE INDEX "_faq_page_v_snapshot_idx" ON "_faq_page_v" USING btree ("snapshot");
  CREATE INDEX "_faq_page_v_published_locale_idx" ON "_faq_page_v" USING btree ("published_locale");
  CREATE INDEX "_faq_page_v_latest_idx" ON "_faq_page_v" USING btree ("latest");
  CREATE UNIQUE INDEX "_faq_page_v_locales_locale_parent_id_unique" ON "_faq_page_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_faq_page_v_texts_order_parent" ON "_faq_page_v_texts" USING btree ("order","parent_id");
  CREATE INDEX "_faq_page_v_texts_locale_parent" ON "_faq_page_v_texts" USING btree ("locale","parent_id");`);
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "users_roles" CASCADE;
  DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "pages" CASCADE;
  DROP TABLE "pages_locales" CASCADE;
  DROP TABLE "pages_texts" CASCADE;
  DROP TABLE "_pages_v" CASCADE;
  DROP TABLE "_pages_v_locales" CASCADE;
  DROP TABLE "_pages_v_texts" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "media_locales" CASCADE;
  DROP TABLE "editorial_events" CASCADE;
  DROP TABLE "product_category_content_application_notes" CASCADE;
  DROP TABLE "product_category_content" CASCADE;
  DROP TABLE "product_category_content_locales" CASCADE;
  DROP TABLE "product_category_content_texts" CASCADE;
  DROP TABLE "_product_category_content_v_version_application_notes" CASCADE;
  DROP TABLE "_product_category_content_v" CASCADE;
  DROP TABLE "_product_category_content_v_locales" CASCADE;
  DROP TABLE "_product_category_content_v_texts" CASCADE;
  DROP TABLE "faq_entries_related_category_keys" CASCADE;
  DROP TABLE "faq_entries" CASCADE;
  DROP TABLE "faq_entries_locales" CASCADE;
  DROP TABLE "_faq_entries_v_version_related_category_keys" CASCADE;
  DROP TABLE "_faq_entries_v" CASCADE;
  DROP TABLE "_faq_entries_v_locales" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TABLE "about_us_who_we_are_positions" CASCADE;
  DROP TABLE "about_us_who_we_are_positions_locales" CASCADE;
  DROP TABLE "about_us_expertise_items" CASCADE;
  DROP TABLE "about_us_expertise_items_locales" CASCADE;
  DROP TABLE "about_us_competitive_advantages_items" CASCADE;
  DROP TABLE "about_us_competitive_advantages_items_locales" CASCADE;
  DROP TABLE "about_us_team_functions" CASCADE;
  DROP TABLE "about_us_team_functions_locales" CASCADE;
  DROP TABLE "about_us_quality_standards_items" CASCADE;
  DROP TABLE "about_us_quality_standards_items_locales" CASCADE;
  DROP TABLE "about_us_closing_routes" CASCADE;
  DROP TABLE "about_us_closing_routes_locales" CASCADE;
  DROP TABLE "about_us" CASCADE;
  DROP TABLE "about_us_locales" CASCADE;
  DROP TABLE "about_us_texts" CASCADE;
  DROP TABLE "_about_us_v_version_who_we_are_positions" CASCADE;
  DROP TABLE "_about_us_v_version_who_we_are_positions_locales" CASCADE;
  DROP TABLE "_about_us_v_version_expertise_items" CASCADE;
  DROP TABLE "_about_us_v_version_expertise_items_locales" CASCADE;
  DROP TABLE "_about_us_v_version_competitive_advantages_items" CASCADE;
  DROP TABLE "_about_us_v_version_competitive_advantages_items_locales" CASCADE;
  DROP TABLE "_about_us_v_version_team_functions" CASCADE;
  DROP TABLE "_about_us_v_version_team_functions_locales" CASCADE;
  DROP TABLE "_about_us_v_version_quality_standards_items" CASCADE;
  DROP TABLE "_about_us_v_version_quality_standards_items_locales" CASCADE;
  DROP TABLE "_about_us_v_version_closing_routes" CASCADE;
  DROP TABLE "_about_us_v_version_closing_routes_locales" CASCADE;
  DROP TABLE "_about_us_v" CASCADE;
  DROP TABLE "_about_us_v_locales" CASCADE;
  DROP TABLE "_about_us_v_texts" CASCADE;
  DROP TABLE "customized_solutions_process_steps" CASCADE;
  DROP TABLE "customized_solutions_process_steps_locales" CASCADE;
  DROP TABLE "customized_solutions_what_can_we_customize" CASCADE;
  DROP TABLE "customized_solutions" CASCADE;
  DROP TABLE "customized_solutions_locales" CASCADE;
  DROP TABLE "customized_solutions_texts" CASCADE;
  DROP TABLE "_customized_solutions_v_version_process_steps" CASCADE;
  DROP TABLE "_customized_solutions_v_version_process_steps_locales" CASCADE;
  DROP TABLE "_customized_solutions_v_version_what_can_we_customize" CASCADE;
  DROP TABLE "_customized_solutions_v" CASCADE;
  DROP TABLE "_customized_solutions_v_locales" CASCADE;
  DROP TABLE "_customized_solutions_v_texts" CASCADE;
  DROP TABLE "quality_approach_stages" CASCADE;
  DROP TABLE "quality_approach_stages_locales" CASCADE;
  DROP TABLE "quality_laboratory_properties" CASCADE;
  DROP TABLE "quality_laboratory_properties_locales" CASCADE;
  DROP TABLE "quality_laboratory_unpublished" CASCADE;
  DROP TABLE "quality_laboratory_unpublished_locales" CASCADE;
  DROP TABLE "quality_documentation_documents" CASCADE;
  DROP TABLE "quality_documentation_documents_locales" CASCADE;
  DROP TABLE "quality_sampling_families" CASCADE;
  DROP TABLE "quality_closing_routes" CASCADE;
  DROP TABLE "quality_closing_routes_locales" CASCADE;
  DROP TABLE "quality" CASCADE;
  DROP TABLE "quality_locales" CASCADE;
  DROP TABLE "quality_texts" CASCADE;
  DROP TABLE "_quality_v_version_approach_stages" CASCADE;
  DROP TABLE "_quality_v_version_approach_stages_locales" CASCADE;
  DROP TABLE "_quality_v_version_laboratory_properties" CASCADE;
  DROP TABLE "_quality_v_version_laboratory_properties_locales" CASCADE;
  DROP TABLE "_quality_v_version_laboratory_unpublished" CASCADE;
  DROP TABLE "_quality_v_version_laboratory_unpublished_locales" CASCADE;
  DROP TABLE "_quality_v_version_documentation_documents" CASCADE;
  DROP TABLE "_quality_v_version_documentation_documents_locales" CASCADE;
  DROP TABLE "_quality_v_version_sampling_families" CASCADE;
  DROP TABLE "_quality_v_version_closing_routes" CASCADE;
  DROP TABLE "_quality_v_version_closing_routes_locales" CASCADE;
  DROP TABLE "_quality_v" CASCADE;
  DROP TABLE "_quality_v_locales" CASCADE;
  DROP TABLE "_quality_v_texts" CASCADE;
  DROP TABLE "contact_us" CASCADE;
  DROP TABLE "contact_us_locales" CASCADE;
  DROP TABLE "_contact_us_v" CASCADE;
  DROP TABLE "_contact_us_v_locales" CASCADE;
  DROP TABLE "faq_page" CASCADE;
  DROP TABLE "faq_page_locales" CASCADE;
  DROP TABLE "faq_page_texts" CASCADE;
  DROP TABLE "_faq_page_v" CASCADE;
  DROP TABLE "_faq_page_v_locales" CASCADE;
  DROP TABLE "_faq_page_v_texts" CASCADE;
  DROP TYPE "public"."_locales";
  DROP TYPE "public"."enum_users_roles";
  DROP TYPE "public"."enum_pages_seo_twitter_card_type";
  DROP TYPE "public"."enum_pages_status";
  DROP TYPE "public"."enum__pages_v_version_seo_twitter_card_type";
  DROP TYPE "public"."enum__pages_v_version_status";
  DROP TYPE "public"."enum__pages_v_published_locale";
  DROP TYPE "public"."enum_editorial_events_action";
  DROP TYPE "public"."enum_product_category_content_category_key";
  DROP TYPE "public"."enum_product_category_content_seo_twitter_card_type";
  DROP TYPE "public"."enum_product_category_content_status";
  DROP TYPE "public"."enum__product_category_content_v_version_category_key";
  DROP TYPE "public"."enum__product_category_content_v_version_seo_twitter_card_type";
  DROP TYPE "public"."enum__product_category_content_v_version_status";
  DROP TYPE "public"."enum__product_category_content_v_published_locale";
  DROP TYPE "public"."enum_faq_entries_related_category_keys";
  DROP TYPE "public"."enum_faq_entries_topic";
  DROP TYPE "public"."enum_faq_entries_status";
  DROP TYPE "public"."enum__faq_entries_v_version_related_category_keys";
  DROP TYPE "public"."enum__faq_entries_v_version_topic";
  DROP TYPE "public"."enum__faq_entries_v_version_status";
  DROP TYPE "public"."enum__faq_entries_v_published_locale";
  DROP TYPE "public"."enum_about_us_expertise_items_icon";
  DROP TYPE "public"."enum_about_us_competitive_advantages_items_icon";
  DROP TYPE "public"."enum_about_us_closing_routes_route";
  DROP TYPE "public"."enum_about_us_hero_primary_cta_route";
  DROP TYPE "public"."enum_about_us_hero_secondary_cta_route";
  DROP TYPE "public"."enum_about_us_quality_standards_footnote_cta_route";
  DROP TYPE "public"."enum_about_us_closing_primary_cta_route";
  DROP TYPE "public"."enum_about_us_seo_twitter_card_type";
  DROP TYPE "public"."enum_about_us_status";
  DROP TYPE "public"."enum__about_us_v_version_expertise_items_icon";
  DROP TYPE "public"."enum__about_us_v_version_competitive_advantages_items_icon";
  DROP TYPE "public"."enum__about_us_v_version_closing_routes_route";
  DROP TYPE "public"."enum__about_us_v_version_hero_primary_cta_route";
  DROP TYPE "public"."enum__about_us_v_version_hero_secondary_cta_route";
  DROP TYPE "public"."enum__about_us_v_version_quality_standards_footnote_cta_route";
  DROP TYPE "public"."enum__about_us_v_version_closing_primary_cta_route";
  DROP TYPE "public"."enum__about_us_v_version_seo_twitter_card_type";
  DROP TYPE "public"."enum__about_us_v_version_status";
  DROP TYPE "public"."enum__about_us_v_published_locale";
  DROP TYPE "public"."enum_customized_solutions_hero_route_cta_route";
  DROP TYPE "public"."enum_customized_solutions_seo_twitter_card_type";
  DROP TYPE "public"."enum_customized_solutions_status";
  DROP TYPE "public"."enum__customized_solutions_v_version_hero_route_cta_route";
  DROP TYPE "public"."enum__customized_solutions_v_version_seo_twitter_card_type";
  DROP TYPE "public"."enum__customized_solutions_v_version_status";
  DROP TYPE "public"."enum__customized_solutions_v_published_locale";
  DROP TYPE "public"."enum_quality_sampling_families";
  DROP TYPE "public"."enum_quality_closing_routes_route";
  DROP TYPE "public"."enum_quality_hero_primary_cta_route";
  DROP TYPE "public"."enum_quality_hero_secondary_cta_route";
  DROP TYPE "public"."enum_quality_closing_primary_cta_route";
  DROP TYPE "public"."enum_quality_seo_twitter_card_type";
  DROP TYPE "public"."enum_quality_status";
  DROP TYPE "public"."enum__quality_v_version_sampling_families";
  DROP TYPE "public"."enum__quality_v_version_closing_routes_route";
  DROP TYPE "public"."enum__quality_v_version_hero_primary_cta_route";
  DROP TYPE "public"."enum__quality_v_version_hero_secondary_cta_route";
  DROP TYPE "public"."enum__quality_v_version_closing_primary_cta_route";
  DROP TYPE "public"."enum__quality_v_version_seo_twitter_card_type";
  DROP TYPE "public"."enum__quality_v_version_status";
  DROP TYPE "public"."enum__quality_v_published_locale";
  DROP TYPE "public"."enum_contact_us_status";
  DROP TYPE "public"."enum__contact_us_v_version_status";
  DROP TYPE "public"."enum__contact_us_v_published_locale";
  DROP TYPE "public"."enum_faq_page_seo_twitter_card_type";
  DROP TYPE "public"."enum_faq_page_status";
  DROP TYPE "public"."enum__faq_page_v_version_seo_twitter_card_type";
  DROP TYPE "public"."enum__faq_page_v_version_status";
  DROP TYPE "public"."enum__faq_page_v_published_locale";`);
}
