import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres";

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_home_lists_who_we_are_source" AS ENUM('0', '1', '2');
  CREATE TYPE "public"."enum_home_lists_trust_indicators_source" AS ENUM('0', '1', '2', '3');
  CREATE TYPE "public"."enum_home_lists_advantages_source" AS ENUM('0', '1', '2', '3', '4', '5');
  CREATE TYPE "public"."enum_home_lists_industries_source" AS ENUM('0', '1', '2', '3', '4');
  CREATE TYPE "public"."enum_home_lists_custom_steps_source" AS ENUM('0', '1', '2', '3', '4', '5');
  CREATE TYPE "public"."enum_home_seo_twitter_card_type" AS ENUM('summary', 'summary_large_image');
  CREATE TYPE "public"."enum_home_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__home_v_version_lists_who_we_are_source" AS ENUM('0', '1', '2');
  CREATE TYPE "public"."enum__home_v_version_lists_trust_indicators_source" AS ENUM('0', '1', '2', '3');
  CREATE TYPE "public"."enum__home_v_version_lists_advantages_source" AS ENUM('0', '1', '2', '3', '4', '5');
  CREATE TYPE "public"."enum__home_v_version_lists_industries_source" AS ENUM('0', '1', '2', '3', '4');
  CREATE TYPE "public"."enum__home_v_version_lists_custom_steps_source" AS ENUM('0', '1', '2', '3', '4', '5');
  CREATE TYPE "public"."enum__home_v_version_seo_twitter_card_type" AS ENUM('summary', 'summary_large_image');
  CREATE TYPE "public"."enum__home_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__home_v_published_locale" AS ENUM('en', 'fa', 'ar');
  CREATE TYPE "public"."enum_products_landing_lists_finder_facets_source" AS ENUM('0', '1');
  CREATE TYPE "public"."enum_products_landing_lists_document_tiers_source" AS ENUM('0', '1');
  CREATE TYPE "public"."enum_products_landing_lists_closing_routes_source" AS ENUM('0', '1', '2');
  CREATE TYPE "public"."enum_products_landing_seo_twitter_card_type" AS ENUM('summary', 'summary_large_image');
  CREATE TYPE "public"."enum_products_landing_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__products_landing_v_version_lists_finder_facets_source" AS ENUM('0', '1');
  CREATE TYPE "public"."enum__products_landing_v_version_lists_document_tiers_source" AS ENUM('0', '1');
  CREATE TYPE "public"."enum__products_landing_v_version_lists_closing_routes_source" AS ENUM('0', '1', '2');
  CREATE TYPE "public"."enum__products_landing_v_version_seo_twitter_card_type" AS ENUM('summary', 'summary_large_image');
  CREATE TYPE "public"."enum__products_landing_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__products_landing_v_published_locale" AS ENUM('en', 'fa', 'ar');
  CREATE TYPE "public"."enum_export_logistics_lists_brief_fields_source" AS ENUM('0', '1', '2', '3', '4');
  CREATE TYPE "public"."enum_export_logistics_lists_delivery_steps_source" AS ENUM('0', '1', '2', '3', '4', '5', '6', '7');
  CREATE TYPE "public"."enum_export_logistics_lists_packaging_source" AS ENUM('0', '1', '2', '3', '4', '5');
  CREATE TYPE "public"."enum_export_logistics_lists_incoterms_source" AS ENUM('0', '1', '2', '3');
  CREATE TYPE "public"."enum_export_logistics_seo_twitter_card_type" AS ENUM('summary', 'summary_large_image');
  CREATE TYPE "public"."enum_export_logistics_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__export_logistics_v_version_lists_brief_fields_source" AS ENUM('0', '1', '2', '3', '4');
  CREATE TYPE "public"."enum__export_logistics_v_version_lists_delivery_steps_source" AS ENUM('0', '1', '2', '3', '4', '5', '6', '7');
  CREATE TYPE "public"."enum__export_logistics_v_version_lists_packaging_source" AS ENUM('0', '1', '2', '3', '4', '5');
  CREATE TYPE "public"."enum__export_logistics_v_version_lists_incoterms_source" AS ENUM('0', '1', '2', '3');
  CREATE TYPE "public"."enum__export_logistics_v_version_seo_twitter_card_type" AS ENUM('summary', 'summary_large_image');
  CREATE TYPE "public"."enum__export_logistics_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__export_logistics_v_published_locale" AS ENUM('en', 'fa', 'ar');
  CREATE TYPE "public"."enum_header_lists_navigation_source" AS ENUM('0', '1', '2', '3', '4', '5');
  CREATE TYPE "public"."enum_header_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__header_v_version_lists_navigation_source" AS ENUM('0', '1', '2', '3', '4', '5');
  CREATE TYPE "public"."enum__header_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__header_v_published_locale" AS ENUM('en', 'fa', 'ar');
  CREATE TYPE "public"."enum_footer_lists_columns_source" AS ENUM('0', '1');
  CREATE TYPE "public"."enum_footer_lists_company_links_source" AS ENUM('0', '1', '2', '3');
  CREATE TYPE "public"."enum_footer_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__footer_v_version_lists_columns_source" AS ENUM('0', '1');
  CREATE TYPE "public"."enum__footer_v_version_lists_company_links_source" AS ENUM('0', '1', '2', '3');
  CREATE TYPE "public"."enum__footer_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__footer_v_published_locale" AS ENUM('en', 'fa', 'ar');
  CREATE TABLE "home_lists_who_we_are" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"source" "enum_home_lists_who_we_are_source"
  );
  
  CREATE TABLE "home_lists_who_we_are_locales" (
  	"term" varchar,
  	"detail" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "home_lists_trust_indicators" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"source" "enum_home_lists_trust_indicators_source"
  );
  
  CREATE TABLE "home_lists_trust_indicators_locales" (
  	"title" varchar,
  	"body" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "home_lists_advantages" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"source" "enum_home_lists_advantages_source"
  );
  
  CREATE TABLE "home_lists_advantages_locales" (
  	"title" varchar,
  	"body" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "home_lists_industries" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"source" "enum_home_lists_industries_source"
  );
  
  CREATE TABLE "home_lists_industries_locales" (
  	"name" varchar,
  	"body" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "home_lists_custom_steps" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"source" "enum_home_lists_custom_steps_source"
  );
  
  CREATE TABLE "home_lists_custom_steps_locales" (
  	"n" varchar,
  	"title" varchar,
  	"body" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "home" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"seo_canonical_url" varchar,
  	"seo_twitter_card_type" "enum_home_seo_twitter_card_type" DEFAULT 'summary_large_image',
  	"seo_robots_index" boolean DEFAULT true,
  	"seo_robots_follow" boolean DEFAULT true,
  	"_status" "enum_home_status" DEFAULT 'draft',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "home_locales" (
  	"hero_petroleum_products_for_professional_buyers" varchar,
  	"hero_base_oils_and_lubricants" varchar,
  	"hero_produced_not_traded" varchar,
  	"hero_specified_with_you" varchar,
  	"hero_sam_group_produces_and_supplies" varchar,
  	"hero_explore_our_products" varchar,
  	"hero_request_a_quotation" varchar,
  	"hero_portfolio_at_a_glance" varchar,
  	"hero_explore_the_sam_group_portfolio" varchar,
  	"who_we_are_who_we_are" varchar,
  	"who_we_are_a_manufacturer" varchar,
  	"who_we_are_not_a_trading_company" varchar,
  	"who_we_are_sam_group_produces_base_oils" varchar,
  	"who_we_are_learn_more_about_sam_group" varchar,
  	"who_we_are_industrial_lubricant_samples_and_packaging" varchar,
  	"who_we_are_caption_6" varchar,
  	"trust_trust_indicators" varchar,
  	"trust_what_buying_from_the_producer" varchar,
  	"trust_four_things_that_follow_from" varchar,
  	"ecosystem_our_products" varchar,
  	"ecosystem_six_families_and_one_route" varchar,
  	"ecosystem_a_range_built_for_lubricant" varchar,
  	"ecosystem_family_0" varchar,
  	"ecosystem_explore_this_range" varchar,
  	"advantages_why_businesses_choose_sam_group" varchar,
  	"advantages_six_reasons_buyers_work_with" varchar,
  	"advantages_the_practical_differences_between_buying" varchar,
  	"industries_industries_we_serve" varchar,
  	"industries_where_these_products_go_to" varchar,
  	"industries_the_same_catalogue_reaches_five" varchar,
  	"custom_formulation_customized_solutions" varchar,
  	"custom_formulation_when_the_catalogue_is_only" varchar,
  	"custom_formulation_where_a_standard_product_does" varchar,
  	"custom_formulation_oil_sample_review_beside_packaged" varchar,
  	"custom_formulation_from_requirement_to_finished_product" varchar,
  	"custom_formulation_step" varchar,
  	"custom_formulation_primary_cta" varchar,
  	"custom_formulation_secondary_cta" varchar,
  	"network_export_enquiry_and_logistics_planning" varchar,
  	"network_define_the_product_prepare_the" varchar,
  	"network_bring_the_grade_required_quantity" varchar,
  	"network_a_destination_to_read_it" varchar,
  	"network_sealed_lubricant_drums_and_an" varchar,
  	"network_product_grade" varchar,
  	"network_packaging_destination" varchar,
  	"network_a_destination" varchar,
  	"network_export_destination" varchar,
  	"network_route_drawn_to_destination" varchar,
  	"network_caption_10" varchar,
  	"insights_sam_group_insights" varchar,
  	"insights_practical_knowledge_for_better_product" varchar,
  	"insights_read_clear_guidance_on_product" varchar,
  	"insights_explore_insights" varchar,
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
  
  CREATE TABLE "home_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar,
  	"locale" "_locales"
  );
  
  CREATE TABLE "_home_v_version_lists_who_we_are" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"source" "enum__home_v_version_lists_who_we_are_source",
  	"_uuid" varchar
  );
  
  CREATE TABLE "_home_v_version_lists_who_we_are_locales" (
  	"term" varchar,
  	"detail" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_home_v_version_lists_trust_indicators" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"source" "enum__home_v_version_lists_trust_indicators_source",
  	"_uuid" varchar
  );
  
  CREATE TABLE "_home_v_version_lists_trust_indicators_locales" (
  	"title" varchar,
  	"body" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_home_v_version_lists_advantages" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"source" "enum__home_v_version_lists_advantages_source",
  	"_uuid" varchar
  );
  
  CREATE TABLE "_home_v_version_lists_advantages_locales" (
  	"title" varchar,
  	"body" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_home_v_version_lists_industries" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"source" "enum__home_v_version_lists_industries_source",
  	"_uuid" varchar
  );
  
  CREATE TABLE "_home_v_version_lists_industries_locales" (
  	"name" varchar,
  	"body" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_home_v_version_lists_custom_steps" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"source" "enum__home_v_version_lists_custom_steps_source",
  	"_uuid" varchar
  );
  
  CREATE TABLE "_home_v_version_lists_custom_steps_locales" (
  	"n" varchar,
  	"title" varchar,
  	"body" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_home_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version_seo_canonical_url" varchar,
  	"version_seo_twitter_card_type" "enum__home_v_version_seo_twitter_card_type" DEFAULT 'summary_large_image',
  	"version_seo_robots_index" boolean DEFAULT true,
  	"version_seo_robots_follow" boolean DEFAULT true,
  	"version__status" "enum__home_v_version_status" DEFAULT 'draft',
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "enum__home_v_published_locale",
  	"latest" boolean
  );
  
  CREATE TABLE "_home_v_locales" (
  	"version_hero_petroleum_products_for_professional_buyers" varchar,
  	"version_hero_base_oils_and_lubricants" varchar,
  	"version_hero_produced_not_traded" varchar,
  	"version_hero_specified_with_you" varchar,
  	"version_hero_sam_group_produces_and_supplies" varchar,
  	"version_hero_explore_our_products" varchar,
  	"version_hero_request_a_quotation" varchar,
  	"version_hero_portfolio_at_a_glance" varchar,
  	"version_hero_explore_the_sam_group_portfolio" varchar,
  	"version_who_we_are_who_we_are" varchar,
  	"version_who_we_are_a_manufacturer" varchar,
  	"version_who_we_are_not_a_trading_company" varchar,
  	"version_who_we_are_sam_group_produces_base_oils" varchar,
  	"version_who_we_are_learn_more_about_sam_group" varchar,
  	"version_who_we_are_industrial_lubricant_samples_and_packaging" varchar,
  	"version_who_we_are_caption_6" varchar,
  	"version_trust_trust_indicators" varchar,
  	"version_trust_what_buying_from_the_producer" varchar,
  	"version_trust_four_things_that_follow_from" varchar,
  	"version_ecosystem_our_products" varchar,
  	"version_ecosystem_six_families_and_one_route" varchar,
  	"version_ecosystem_a_range_built_for_lubricant" varchar,
  	"version_ecosystem_family_0" varchar,
  	"version_ecosystem_explore_this_range" varchar,
  	"version_advantages_why_businesses_choose_sam_group" varchar,
  	"version_advantages_six_reasons_buyers_work_with" varchar,
  	"version_advantages_the_practical_differences_between_buying" varchar,
  	"version_industries_industries_we_serve" varchar,
  	"version_industries_where_these_products_go_to" varchar,
  	"version_industries_the_same_catalogue_reaches_five" varchar,
  	"version_custom_formulation_customized_solutions" varchar,
  	"version_custom_formulation_when_the_catalogue_is_only" varchar,
  	"version_custom_formulation_where_a_standard_product_does" varchar,
  	"version_custom_formulation_oil_sample_review_beside_packaged" varchar,
  	"version_custom_formulation_from_requirement_to_finished_product" varchar,
  	"version_custom_formulation_step" varchar,
  	"version_custom_formulation_primary_cta" varchar,
  	"version_custom_formulation_secondary_cta" varchar,
  	"version_network_export_enquiry_and_logistics_planning" varchar,
  	"version_network_define_the_product_prepare_the" varchar,
  	"version_network_bring_the_grade_required_quantity" varchar,
  	"version_network_a_destination_to_read_it" varchar,
  	"version_network_sealed_lubricant_drums_and_an" varchar,
  	"version_network_product_grade" varchar,
  	"version_network_packaging_destination" varchar,
  	"version_network_a_destination" varchar,
  	"version_network_export_destination" varchar,
  	"version_network_route_drawn_to_destination" varchar,
  	"version_network_caption_10" varchar,
  	"version_insights_sam_group_insights" varchar,
  	"version_insights_practical_knowledge_for_better_product" varchar,
  	"version_insights_read_clear_guidance_on_product" varchar,
  	"version_insights_explore_insights" varchar,
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
  
  CREATE TABLE "_home_v_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar,
  	"locale" "_locales"
  );
  
  CREATE TABLE "products_landing_lists_finder_facets" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"source" "enum_products_landing_lists_finder_facets_source"
  );
  
  CREATE TABLE "products_landing_lists_finder_facets_locales" (
  	"name" varchar,
  	"sample" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "products_landing_lists_document_tiers" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"source" "enum_products_landing_lists_document_tiers_source"
  );
  
  CREATE TABLE "products_landing_lists_document_tiers_locales" (
  	"heading" varchar,
  	"note" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "products_landing_lists_closing_routes" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"source" "enum_products_landing_lists_closing_routes_source"
  );
  
  CREATE TABLE "products_landing_lists_closing_routes_locales" (
  	"label" varchar,
  	"qualifier" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "products_landing" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"seo_canonical_url" varchar,
  	"seo_twitter_card_type" "enum_products_landing_seo_twitter_card_type" DEFAULT 'summary_large_image',
  	"seo_robots_index" boolean DEFAULT true,
  	"seo_robots_follow" boolean DEFAULT true,
  	"_status" "enum_products_landing_status" DEFAULT 'draft',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "products_landing_locales" (
  	"hero_products" varchar,
  	"hero_find_the_product_define_the" varchar,
  	"hero_browse_base_oils_additives_automotive" varchar,
  	"hero_open_product_finder" varchar,
  	"hero_request_a_quote" varchar,
  	"hero_industrial_lubricant_containers_and_oil" varchar,
  	"hero_caption_6" varchar,
  	"register_the_range" varchar,
  	"register_start_with_the_product_family" varchar,
  	"register_each_family_brings_its_published" varchar,
  	"register_more_on_the_family_page" varchar,
  	"register_view_range" varchar,
  	"catalogue_structure_how_the_catalogue_is_organised" varchar,
  	"catalogue_structure_family_product_grade_technical_data" varchar,
  	"finder_teaser_product_finder" varchar,
  	"finder_teaser_filter_to_the_grade" varchar,
  	"finder_teaser_narrow_the_published_range_by" varchar,
  	"finder_teaser__or_search_directly_by" varchar,
  	"finder_teaser_open_product_finder" varchar,
  	"finder_teaser_selection_parameters" varchar,
  	"finder_teaser_direct" varchar,
  	"finder_teaser_search_by_product_grade_or" varchar,
  	"documentation_documentation" varchar,
  	"documentation_specifications_first_forms_second" varchar,
  	"closing_cta_next_step" varchar,
  	"closing_cta_cant_find_exactly_what_you" varchar,
  	"closing_cta_the_range_above_is_what" varchar,
  	"closing_cta_request_a_custom_solution" varchar,
  	"closing_cta_or_take_a_shorter_route" varchar,
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
  
  CREATE TABLE "products_landing_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar,
  	"locale" "_locales"
  );
  
  CREATE TABLE "_products_landing_v_version_lists_finder_facets" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"source" "enum__products_landing_v_version_lists_finder_facets_source",
  	"_uuid" varchar
  );
  
  CREATE TABLE "_products_landing_v_version_lists_finder_facets_locales" (
  	"name" varchar,
  	"sample" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_products_landing_v_version_lists_document_tiers" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"source" "enum__products_landing_v_version_lists_document_tiers_source",
  	"_uuid" varchar
  );
  
  CREATE TABLE "_products_landing_v_version_lists_document_tiers_locales" (
  	"heading" varchar,
  	"note" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_products_landing_v_version_lists_closing_routes" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"source" "enum__products_landing_v_version_lists_closing_routes_source",
  	"_uuid" varchar
  );
  
  CREATE TABLE "_products_landing_v_version_lists_closing_routes_locales" (
  	"label" varchar,
  	"qualifier" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_products_landing_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version_seo_canonical_url" varchar,
  	"version_seo_twitter_card_type" "enum__products_landing_v_version_seo_twitter_card_type" DEFAULT 'summary_large_image',
  	"version_seo_robots_index" boolean DEFAULT true,
  	"version_seo_robots_follow" boolean DEFAULT true,
  	"version__status" "enum__products_landing_v_version_status" DEFAULT 'draft',
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "enum__products_landing_v_published_locale",
  	"latest" boolean
  );
  
  CREATE TABLE "_products_landing_v_locales" (
  	"version_hero_products" varchar,
  	"version_hero_find_the_product_define_the" varchar,
  	"version_hero_browse_base_oils_additives_automotive" varchar,
  	"version_hero_open_product_finder" varchar,
  	"version_hero_request_a_quote" varchar,
  	"version_hero_industrial_lubricant_containers_and_oil" varchar,
  	"version_hero_caption_6" varchar,
  	"version_register_the_range" varchar,
  	"version_register_start_with_the_product_family" varchar,
  	"version_register_each_family_brings_its_published" varchar,
  	"version_register_more_on_the_family_page" varchar,
  	"version_register_view_range" varchar,
  	"version_catalogue_structure_how_the_catalogue_is_organised" varchar,
  	"version_catalogue_structure_family_product_grade_technical_data" varchar,
  	"version_finder_teaser_product_finder" varchar,
  	"version_finder_teaser_filter_to_the_grade" varchar,
  	"version_finder_teaser_narrow_the_published_range_by" varchar,
  	"version_finder_teaser__or_search_directly_by" varchar,
  	"version_finder_teaser_open_product_finder" varchar,
  	"version_finder_teaser_selection_parameters" varchar,
  	"version_finder_teaser_direct" varchar,
  	"version_finder_teaser_search_by_product_grade_or" varchar,
  	"version_documentation_documentation" varchar,
  	"version_documentation_specifications_first_forms_second" varchar,
  	"version_closing_cta_next_step" varchar,
  	"version_closing_cta_cant_find_exactly_what_you" varchar,
  	"version_closing_cta_the_range_above_is_what" varchar,
  	"version_closing_cta_request_a_custom_solution" varchar,
  	"version_closing_cta_or_take_a_shorter_route" varchar,
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
  
  CREATE TABLE "_products_landing_v_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar,
  	"locale" "_locales"
  );
  
  CREATE TABLE "export_logistics_lists_brief_fields" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"source" "enum_export_logistics_lists_brief_fields_source"
  );
  
  CREATE TABLE "export_logistics_lists_brief_fields_locales" (
  	"title" varchar,
  	"description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "export_logistics_lists_delivery_steps" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"source" "enum_export_logistics_lists_delivery_steps_source"
  );
  
  CREATE TABLE "export_logistics_lists_delivery_steps_locales" (
  	"title" varchar,
  	"description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "export_logistics_lists_packaging" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"source" "enum_export_logistics_lists_packaging_source"
  );
  
  CREATE TABLE "export_logistics_lists_packaging_locales" (
  	"title" varchar,
  	"description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "export_logistics_lists_incoterms" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"source" "enum_export_logistics_lists_incoterms_source"
  );
  
  CREATE TABLE "export_logistics_lists_incoterms_locales" (
  	"title" varchar,
  	"description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "export_logistics" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"seo_canonical_url" varchar,
  	"seo_twitter_card_type" "enum_export_logistics_seo_twitter_card_type" DEFAULT 'summary_large_image',
  	"seo_robots_index" boolean DEFAULT true,
  	"seo_robots_follow" boolean DEFAULT true,
  	"_status" "enum_export_logistics_status" DEFAULT 'draft',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "export_logistics_locales" (
  	"page_export_and_logistics" varchar,
  	"page_plan_the_product_and_the" varchar,
  	"page_a_useful_export_enquiry_combines" varchar,
  	"page_discuss_an_export_requirement" varchar,
  	"page_view_packaging_options" varchar,
  	"page_petroleum_product_logistics_planning_with" varchar,
  	"page_product_packaging_destination_trade_term" varchar,
  	"page_start_with_a_complete_brief" varchar,
  	"page_five_details_make_an_export" varchar,
  	"page_share_what_is_already_known" varchar,
  	"page_from_requirement_to_delivery" varchar,
  	"page_a_clear_path_from_enquiry" varchar,
  	"page_the_sequence_keeps_technical_commercial" varchar,
  	"page_flexible_shipping_and_packaging" varchar,
  	"page_packaging_selected_around_product_and" varchar,
  	"page_available_formats_depend_on_the" varchar,
  	"page_incoterms_and_commercial_scope" varchar,
  	"page_state_the_trade_term_early" varchar,
  	"page_indicate_exw_fob_cfr_cif" varchar,
  	"page_preparing_an_export_enquiry" varchar,
  	"page_send_the_grade_volume_packaging" varchar,
  	"page_request_export_terms" varchar,
  	"page_review_products" varchar,
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
  
  CREATE TABLE "export_logistics_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar,
  	"locale" "_locales"
  );
  
  CREATE TABLE "_export_logistics_v_version_lists_brief_fields" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"source" "enum__export_logistics_v_version_lists_brief_fields_source",
  	"_uuid" varchar
  );
  
  CREATE TABLE "_export_logistics_v_version_lists_brief_fields_locales" (
  	"title" varchar,
  	"description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_export_logistics_v_version_lists_delivery_steps" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"source" "enum__export_logistics_v_version_lists_delivery_steps_source",
  	"_uuid" varchar
  );
  
  CREATE TABLE "_export_logistics_v_version_lists_delivery_steps_locales" (
  	"title" varchar,
  	"description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_export_logistics_v_version_lists_packaging" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"source" "enum__export_logistics_v_version_lists_packaging_source",
  	"_uuid" varchar
  );
  
  CREATE TABLE "_export_logistics_v_version_lists_packaging_locales" (
  	"title" varchar,
  	"description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_export_logistics_v_version_lists_incoterms" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"source" "enum__export_logistics_v_version_lists_incoterms_source",
  	"_uuid" varchar
  );
  
  CREATE TABLE "_export_logistics_v_version_lists_incoterms_locales" (
  	"title" varchar,
  	"description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_export_logistics_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version_seo_canonical_url" varchar,
  	"version_seo_twitter_card_type" "enum__export_logistics_v_version_seo_twitter_card_type" DEFAULT 'summary_large_image',
  	"version_seo_robots_index" boolean DEFAULT true,
  	"version_seo_robots_follow" boolean DEFAULT true,
  	"version__status" "enum__export_logistics_v_version_status" DEFAULT 'draft',
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "enum__export_logistics_v_published_locale",
  	"latest" boolean
  );
  
  CREATE TABLE "_export_logistics_v_locales" (
  	"version_page_export_and_logistics" varchar,
  	"version_page_plan_the_product_and_the" varchar,
  	"version_page_a_useful_export_enquiry_combines" varchar,
  	"version_page_discuss_an_export_requirement" varchar,
  	"version_page_view_packaging_options" varchar,
  	"version_page_petroleum_product_logistics_planning_with" varchar,
  	"version_page_product_packaging_destination_trade_term" varchar,
  	"version_page_start_with_a_complete_brief" varchar,
  	"version_page_five_details_make_an_export" varchar,
  	"version_page_share_what_is_already_known" varchar,
  	"version_page_from_requirement_to_delivery" varchar,
  	"version_page_a_clear_path_from_enquiry" varchar,
  	"version_page_the_sequence_keeps_technical_commercial" varchar,
  	"version_page_flexible_shipping_and_packaging" varchar,
  	"version_page_packaging_selected_around_product_and" varchar,
  	"version_page_available_formats_depend_on_the" varchar,
  	"version_page_incoterms_and_commercial_scope" varchar,
  	"version_page_state_the_trade_term_early" varchar,
  	"version_page_indicate_exw_fob_cfr_cif" varchar,
  	"version_page_preparing_an_export_enquiry" varchar,
  	"version_page_send_the_grade_volume_packaging" varchar,
  	"version_page_request_export_terms" varchar,
  	"version_page_review_products" varchar,
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
  
  CREATE TABLE "_export_logistics_v_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar,
  	"locale" "_locales"
  );
  
  CREATE TABLE "header_lists_navigation" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"source" "enum_header_lists_navigation_source"
  );
  
  CREATE TABLE "header_lists_navigation_locales" (
  	"label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "header" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"_status" "enum_header_status" DEFAULT 'draft',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "header_locales" (
  	"brand_name" varchar,
  	"brand_tagline" varchar,
  	"brand_quote_label" varchar,
  	"brand_product_families" varchar,
  	"brand_find_amp_download" varchar,
  	"brand_product_finder" varchar,
  	"brand_download_catalogue" varchar,
  	"brand_all_products" varchar,
  	"brand_contact_us" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_header_v_version_lists_navigation" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"source" "enum__header_v_version_lists_navigation_source",
  	"_uuid" varchar
  );
  
  CREATE TABLE "_header_v_version_lists_navigation_locales" (
  	"label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_header_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version__status" "enum__header_v_version_status" DEFAULT 'draft',
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "enum__header_v_published_locale",
  	"latest" boolean
  );
  
  CREATE TABLE "_header_v_locales" (
  	"version_brand_name" varchar,
  	"version_brand_tagline" varchar,
  	"version_brand_quote_label" varchar,
  	"version_brand_product_families" varchar,
  	"version_brand_find_amp_download" varchar,
  	"version_brand_product_finder" varchar,
  	"version_brand_download_catalogue" varchar,
  	"version_brand_all_products" varchar,
  	"version_brand_contact_us" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "footer_lists_columns" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"source" "enum_footer_lists_columns_source"
  );
  
  CREATE TABLE "footer_lists_columns_locales" (
  	"heading" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "footer_lists_company_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"source" "enum_footer_lists_company_links_source"
  );
  
  CREATE TABLE "footer_lists_company_links_locales" (
  	"label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "footer" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"_status" "enum_footer_status" DEFAULT 'draft',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "footer_locales" (
  	"brand_name" varchar,
  	"brand_tagline" varchar,
  	"brand_description" varchar,
  	"brand_contact_heading" varchar,
  	"brand_contact_label" varchar,
  	"brand_rights" varchar,
  	"brand_privacy_label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_footer_v_version_lists_columns" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"source" "enum__footer_v_version_lists_columns_source",
  	"_uuid" varchar
  );
  
  CREATE TABLE "_footer_v_version_lists_columns_locales" (
  	"heading" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_footer_v_version_lists_company_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"source" "enum__footer_v_version_lists_company_links_source",
  	"_uuid" varchar
  );
  
  CREATE TABLE "_footer_v_version_lists_company_links_locales" (
  	"label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_footer_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version__status" "enum__footer_v_version_status" DEFAULT 'draft',
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "enum__footer_v_published_locale",
  	"latest" boolean
  );
  
  CREATE TABLE "_footer_v_locales" (
  	"version_brand_name" varchar,
  	"version_brand_tagline" varchar,
  	"version_brand_description" varchar,
  	"version_brand_contact_heading" varchar,
  	"version_brand_contact_label" varchar,
  	"version_brand_rights" varchar,
  	"version_brand_privacy_label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  ALTER TABLE "home_lists_who_we_are" ADD CONSTRAINT "home_lists_who_we_are_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."home"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "home_lists_who_we_are_locales" ADD CONSTRAINT "home_lists_who_we_are_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."home_lists_who_we_are"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "home_lists_trust_indicators" ADD CONSTRAINT "home_lists_trust_indicators_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."home"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "home_lists_trust_indicators_locales" ADD CONSTRAINT "home_lists_trust_indicators_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."home_lists_trust_indicators"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "home_lists_advantages" ADD CONSTRAINT "home_lists_advantages_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."home"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "home_lists_advantages_locales" ADD CONSTRAINT "home_lists_advantages_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."home_lists_advantages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "home_lists_industries" ADD CONSTRAINT "home_lists_industries_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."home"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "home_lists_industries_locales" ADD CONSTRAINT "home_lists_industries_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."home_lists_industries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "home_lists_custom_steps" ADD CONSTRAINT "home_lists_custom_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."home"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "home_lists_custom_steps_locales" ADD CONSTRAINT "home_lists_custom_steps_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."home_lists_custom_steps"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "home_locales" ADD CONSTRAINT "home_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."home"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "home_texts" ADD CONSTRAINT "home_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."home"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_home_v_version_lists_who_we_are" ADD CONSTRAINT "_home_v_version_lists_who_we_are_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_home_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_home_v_version_lists_who_we_are_locales" ADD CONSTRAINT "_home_v_version_lists_who_we_are_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_home_v_version_lists_who_we_are"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_home_v_version_lists_trust_indicators" ADD CONSTRAINT "_home_v_version_lists_trust_indicators_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_home_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_home_v_version_lists_trust_indicators_locales" ADD CONSTRAINT "_home_v_version_lists_trust_indicators_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_home_v_version_lists_trust_indicators"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_home_v_version_lists_advantages" ADD CONSTRAINT "_home_v_version_lists_advantages_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_home_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_home_v_version_lists_advantages_locales" ADD CONSTRAINT "_home_v_version_lists_advantages_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_home_v_version_lists_advantages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_home_v_version_lists_industries" ADD CONSTRAINT "_home_v_version_lists_industries_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_home_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_home_v_version_lists_industries_locales" ADD CONSTRAINT "_home_v_version_lists_industries_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_home_v_version_lists_industries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_home_v_version_lists_custom_steps" ADD CONSTRAINT "_home_v_version_lists_custom_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_home_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_home_v_version_lists_custom_steps_locales" ADD CONSTRAINT "_home_v_version_lists_custom_steps_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_home_v_version_lists_custom_steps"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_home_v_locales" ADD CONSTRAINT "_home_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_home_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_home_v_texts" ADD CONSTRAINT "_home_v_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_home_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_landing_lists_finder_facets" ADD CONSTRAINT "products_landing_lists_finder_facets_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products_landing"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_landing_lists_finder_facets_locales" ADD CONSTRAINT "products_landing_lists_finder_facets_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products_landing_lists_finder_facets"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_landing_lists_document_tiers" ADD CONSTRAINT "products_landing_lists_document_tiers_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products_landing"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_landing_lists_document_tiers_locales" ADD CONSTRAINT "products_landing_lists_document_tiers_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products_landing_lists_document_tiers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_landing_lists_closing_routes" ADD CONSTRAINT "products_landing_lists_closing_routes_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products_landing"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_landing_lists_closing_routes_locales" ADD CONSTRAINT "products_landing_lists_closing_routes_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products_landing_lists_closing_routes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_landing_locales" ADD CONSTRAINT "products_landing_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products_landing"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_landing_texts" ADD CONSTRAINT "products_landing_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."products_landing"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_products_landing_v_version_lists_finder_facets" ADD CONSTRAINT "_products_landing_v_version_lists_finder_facets_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_products_landing_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_products_landing_v_version_lists_finder_facets_locales" ADD CONSTRAINT "_products_landing_v_version_lists_finder_facets_locales_p_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_products_landing_v_version_lists_finder_facets"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_products_landing_v_version_lists_document_tiers" ADD CONSTRAINT "_products_landing_v_version_lists_document_tiers_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_products_landing_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_products_landing_v_version_lists_document_tiers_locales" ADD CONSTRAINT "_products_landing_v_version_lists_document_tiers_locales__fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_products_landing_v_version_lists_document_tiers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_products_landing_v_version_lists_closing_routes" ADD CONSTRAINT "_products_landing_v_version_lists_closing_routes_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_products_landing_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_products_landing_v_version_lists_closing_routes_locales" ADD CONSTRAINT "_products_landing_v_version_lists_closing_routes_locales__fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_products_landing_v_version_lists_closing_routes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_products_landing_v_locales" ADD CONSTRAINT "_products_landing_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_products_landing_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_products_landing_v_texts" ADD CONSTRAINT "_products_landing_v_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_products_landing_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "export_logistics_lists_brief_fields" ADD CONSTRAINT "export_logistics_lists_brief_fields_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."export_logistics"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "export_logistics_lists_brief_fields_locales" ADD CONSTRAINT "export_logistics_lists_brief_fields_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."export_logistics_lists_brief_fields"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "export_logistics_lists_delivery_steps" ADD CONSTRAINT "export_logistics_lists_delivery_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."export_logistics"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "export_logistics_lists_delivery_steps_locales" ADD CONSTRAINT "export_logistics_lists_delivery_steps_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."export_logistics_lists_delivery_steps"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "export_logistics_lists_packaging" ADD CONSTRAINT "export_logistics_lists_packaging_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."export_logistics"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "export_logistics_lists_packaging_locales" ADD CONSTRAINT "export_logistics_lists_packaging_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."export_logistics_lists_packaging"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "export_logistics_lists_incoterms" ADD CONSTRAINT "export_logistics_lists_incoterms_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."export_logistics"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "export_logistics_lists_incoterms_locales" ADD CONSTRAINT "export_logistics_lists_incoterms_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."export_logistics_lists_incoterms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "export_logistics_locales" ADD CONSTRAINT "export_logistics_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."export_logistics"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "export_logistics_texts" ADD CONSTRAINT "export_logistics_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."export_logistics"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_export_logistics_v_version_lists_brief_fields" ADD CONSTRAINT "_export_logistics_v_version_lists_brief_fields_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_export_logistics_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_export_logistics_v_version_lists_brief_fields_locales" ADD CONSTRAINT "_export_logistics_v_version_lists_brief_fields_locales_pa_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_export_logistics_v_version_lists_brief_fields"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_export_logistics_v_version_lists_delivery_steps" ADD CONSTRAINT "_export_logistics_v_version_lists_delivery_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_export_logistics_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_export_logistics_v_version_lists_delivery_steps_locales" ADD CONSTRAINT "_export_logistics_v_version_lists_delivery_steps_locales__fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_export_logistics_v_version_lists_delivery_steps"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_export_logistics_v_version_lists_packaging" ADD CONSTRAINT "_export_logistics_v_version_lists_packaging_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_export_logistics_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_export_logistics_v_version_lists_packaging_locales" ADD CONSTRAINT "_export_logistics_v_version_lists_packaging_locales_paren_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_export_logistics_v_version_lists_packaging"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_export_logistics_v_version_lists_incoterms" ADD CONSTRAINT "_export_logistics_v_version_lists_incoterms_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_export_logistics_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_export_logistics_v_version_lists_incoterms_locales" ADD CONSTRAINT "_export_logistics_v_version_lists_incoterms_locales_paren_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_export_logistics_v_version_lists_incoterms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_export_logistics_v_locales" ADD CONSTRAINT "_export_logistics_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_export_logistics_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_export_logistics_v_texts" ADD CONSTRAINT "_export_logistics_v_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_export_logistics_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "header_lists_navigation" ADD CONSTRAINT "header_lists_navigation_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."header"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "header_lists_navigation_locales" ADD CONSTRAINT "header_lists_navigation_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."header_lists_navigation"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "header_locales" ADD CONSTRAINT "header_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."header"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_header_v_version_lists_navigation" ADD CONSTRAINT "_header_v_version_lists_navigation_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_header_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_header_v_version_lists_navigation_locales" ADD CONSTRAINT "_header_v_version_lists_navigation_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_header_v_version_lists_navigation"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_header_v_locales" ADD CONSTRAINT "_header_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_header_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "footer_lists_columns" ADD CONSTRAINT "footer_lists_columns_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."footer"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "footer_lists_columns_locales" ADD CONSTRAINT "footer_lists_columns_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."footer_lists_columns"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "footer_lists_company_links" ADD CONSTRAINT "footer_lists_company_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."footer"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "footer_lists_company_links_locales" ADD CONSTRAINT "footer_lists_company_links_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."footer_lists_company_links"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "footer_locales" ADD CONSTRAINT "footer_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."footer"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_footer_v_version_lists_columns" ADD CONSTRAINT "_footer_v_version_lists_columns_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_footer_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_footer_v_version_lists_columns_locales" ADD CONSTRAINT "_footer_v_version_lists_columns_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_footer_v_version_lists_columns"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_footer_v_version_lists_company_links" ADD CONSTRAINT "_footer_v_version_lists_company_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_footer_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_footer_v_version_lists_company_links_locales" ADD CONSTRAINT "_footer_v_version_lists_company_links_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_footer_v_version_lists_company_links"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_footer_v_locales" ADD CONSTRAINT "_footer_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_footer_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "home_lists_who_we_are_order_idx" ON "home_lists_who_we_are" USING btree ("_order");
  CREATE INDEX "home_lists_who_we_are_parent_id_idx" ON "home_lists_who_we_are" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "home_lists_who_we_are_locales_locale_parent_id_unique" ON "home_lists_who_we_are_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "home_lists_trust_indicators_order_idx" ON "home_lists_trust_indicators" USING btree ("_order");
  CREATE INDEX "home_lists_trust_indicators_parent_id_idx" ON "home_lists_trust_indicators" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "home_lists_trust_indicators_locales_locale_parent_id_unique" ON "home_lists_trust_indicators_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "home_lists_advantages_order_idx" ON "home_lists_advantages" USING btree ("_order");
  CREATE INDEX "home_lists_advantages_parent_id_idx" ON "home_lists_advantages" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "home_lists_advantages_locales_locale_parent_id_unique" ON "home_lists_advantages_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "home_lists_industries_order_idx" ON "home_lists_industries" USING btree ("_order");
  CREATE INDEX "home_lists_industries_parent_id_idx" ON "home_lists_industries" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "home_lists_industries_locales_locale_parent_id_unique" ON "home_lists_industries_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "home_lists_custom_steps_order_idx" ON "home_lists_custom_steps" USING btree ("_order");
  CREATE INDEX "home_lists_custom_steps_parent_id_idx" ON "home_lists_custom_steps" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "home_lists_custom_steps_locales_locale_parent_id_unique" ON "home_lists_custom_steps_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "home__status_idx" ON "home" USING btree ("_status");
  CREATE UNIQUE INDEX "home_locales_locale_parent_id_unique" ON "home_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "home_texts_order_parent" ON "home_texts" USING btree ("order","parent_id");
  CREATE INDEX "home_texts_locale_parent" ON "home_texts" USING btree ("locale","parent_id");
  CREATE INDEX "_home_v_version_lists_who_we_are_order_idx" ON "_home_v_version_lists_who_we_are" USING btree ("_order");
  CREATE INDEX "_home_v_version_lists_who_we_are_parent_id_idx" ON "_home_v_version_lists_who_we_are" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_home_v_version_lists_who_we_are_locales_locale_parent_id_un" ON "_home_v_version_lists_who_we_are_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_home_v_version_lists_trust_indicators_order_idx" ON "_home_v_version_lists_trust_indicators" USING btree ("_order");
  CREATE INDEX "_home_v_version_lists_trust_indicators_parent_id_idx" ON "_home_v_version_lists_trust_indicators" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_home_v_version_lists_trust_indicators_locales_locale_parent" ON "_home_v_version_lists_trust_indicators_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_home_v_version_lists_advantages_order_idx" ON "_home_v_version_lists_advantages" USING btree ("_order");
  CREATE INDEX "_home_v_version_lists_advantages_parent_id_idx" ON "_home_v_version_lists_advantages" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_home_v_version_lists_advantages_locales_locale_parent_id_un" ON "_home_v_version_lists_advantages_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_home_v_version_lists_industries_order_idx" ON "_home_v_version_lists_industries" USING btree ("_order");
  CREATE INDEX "_home_v_version_lists_industries_parent_id_idx" ON "_home_v_version_lists_industries" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_home_v_version_lists_industries_locales_locale_parent_id_un" ON "_home_v_version_lists_industries_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_home_v_version_lists_custom_steps_order_idx" ON "_home_v_version_lists_custom_steps" USING btree ("_order");
  CREATE INDEX "_home_v_version_lists_custom_steps_parent_id_idx" ON "_home_v_version_lists_custom_steps" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_home_v_version_lists_custom_steps_locales_locale_parent_id_" ON "_home_v_version_lists_custom_steps_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_home_v_version_version__status_idx" ON "_home_v" USING btree ("version__status");
  CREATE INDEX "_home_v_created_at_idx" ON "_home_v" USING btree ("created_at");
  CREATE INDEX "_home_v_updated_at_idx" ON "_home_v" USING btree ("updated_at");
  CREATE INDEX "_home_v_snapshot_idx" ON "_home_v" USING btree ("snapshot");
  CREATE INDEX "_home_v_published_locale_idx" ON "_home_v" USING btree ("published_locale");
  CREATE INDEX "_home_v_latest_idx" ON "_home_v" USING btree ("latest");
  CREATE UNIQUE INDEX "_home_v_locales_locale_parent_id_unique" ON "_home_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_home_v_texts_order_parent" ON "_home_v_texts" USING btree ("order","parent_id");
  CREATE INDEX "_home_v_texts_locale_parent" ON "_home_v_texts" USING btree ("locale","parent_id");
  CREATE INDEX "products_landing_lists_finder_facets_order_idx" ON "products_landing_lists_finder_facets" USING btree ("_order");
  CREATE INDEX "products_landing_lists_finder_facets_parent_id_idx" ON "products_landing_lists_finder_facets" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "products_landing_lists_finder_facets_locales_locale_parent_i" ON "products_landing_lists_finder_facets_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "products_landing_lists_document_tiers_order_idx" ON "products_landing_lists_document_tiers" USING btree ("_order");
  CREATE INDEX "products_landing_lists_document_tiers_parent_id_idx" ON "products_landing_lists_document_tiers" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "products_landing_lists_document_tiers_locales_locale_parent_" ON "products_landing_lists_document_tiers_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "products_landing_lists_closing_routes_order_idx" ON "products_landing_lists_closing_routes" USING btree ("_order");
  CREATE INDEX "products_landing_lists_closing_routes_parent_id_idx" ON "products_landing_lists_closing_routes" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "products_landing_lists_closing_routes_locales_locale_parent_" ON "products_landing_lists_closing_routes_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "products_landing__status_idx" ON "products_landing" USING btree ("_status");
  CREATE UNIQUE INDEX "products_landing_locales_locale_parent_id_unique" ON "products_landing_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "products_landing_texts_order_parent" ON "products_landing_texts" USING btree ("order","parent_id");
  CREATE INDEX "products_landing_texts_locale_parent" ON "products_landing_texts" USING btree ("locale","parent_id");
  CREATE INDEX "_products_landing_v_version_lists_finder_facets_order_idx" ON "_products_landing_v_version_lists_finder_facets" USING btree ("_order");
  CREATE INDEX "_products_landing_v_version_lists_finder_facets_parent_id_idx" ON "_products_landing_v_version_lists_finder_facets" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_products_landing_v_version_lists_finder_facets_locales_loca" ON "_products_landing_v_version_lists_finder_facets_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_products_landing_v_version_lists_document_tiers_order_idx" ON "_products_landing_v_version_lists_document_tiers" USING btree ("_order");
  CREATE INDEX "_products_landing_v_version_lists_document_tiers_parent_id_idx" ON "_products_landing_v_version_lists_document_tiers" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_products_landing_v_version_lists_document_tiers_locales_loc" ON "_products_landing_v_version_lists_document_tiers_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_products_landing_v_version_lists_closing_routes_order_idx" ON "_products_landing_v_version_lists_closing_routes" USING btree ("_order");
  CREATE INDEX "_products_landing_v_version_lists_closing_routes_parent_id_idx" ON "_products_landing_v_version_lists_closing_routes" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_products_landing_v_version_lists_closing_routes_locales_loc" ON "_products_landing_v_version_lists_closing_routes_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_products_landing_v_version_version__status_idx" ON "_products_landing_v" USING btree ("version__status");
  CREATE INDEX "_products_landing_v_created_at_idx" ON "_products_landing_v" USING btree ("created_at");
  CREATE INDEX "_products_landing_v_updated_at_idx" ON "_products_landing_v" USING btree ("updated_at");
  CREATE INDEX "_products_landing_v_snapshot_idx" ON "_products_landing_v" USING btree ("snapshot");
  CREATE INDEX "_products_landing_v_published_locale_idx" ON "_products_landing_v" USING btree ("published_locale");
  CREATE INDEX "_products_landing_v_latest_idx" ON "_products_landing_v" USING btree ("latest");
  CREATE UNIQUE INDEX "_products_landing_v_locales_locale_parent_id_unique" ON "_products_landing_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_products_landing_v_texts_order_parent" ON "_products_landing_v_texts" USING btree ("order","parent_id");
  CREATE INDEX "_products_landing_v_texts_locale_parent" ON "_products_landing_v_texts" USING btree ("locale","parent_id");
  CREATE INDEX "export_logistics_lists_brief_fields_order_idx" ON "export_logistics_lists_brief_fields" USING btree ("_order");
  CREATE INDEX "export_logistics_lists_brief_fields_parent_id_idx" ON "export_logistics_lists_brief_fields" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "export_logistics_lists_brief_fields_locales_locale_parent_id" ON "export_logistics_lists_brief_fields_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "export_logistics_lists_delivery_steps_order_idx" ON "export_logistics_lists_delivery_steps" USING btree ("_order");
  CREATE INDEX "export_logistics_lists_delivery_steps_parent_id_idx" ON "export_logistics_lists_delivery_steps" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "export_logistics_lists_delivery_steps_locales_locale_parent_" ON "export_logistics_lists_delivery_steps_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "export_logistics_lists_packaging_order_idx" ON "export_logistics_lists_packaging" USING btree ("_order");
  CREATE INDEX "export_logistics_lists_packaging_parent_id_idx" ON "export_logistics_lists_packaging" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "export_logistics_lists_packaging_locales_locale_parent_id_un" ON "export_logistics_lists_packaging_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "export_logistics_lists_incoterms_order_idx" ON "export_logistics_lists_incoterms" USING btree ("_order");
  CREATE INDEX "export_logistics_lists_incoterms_parent_id_idx" ON "export_logistics_lists_incoterms" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "export_logistics_lists_incoterms_locales_locale_parent_id_un" ON "export_logistics_lists_incoterms_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "export_logistics__status_idx" ON "export_logistics" USING btree ("_status");
  CREATE UNIQUE INDEX "export_logistics_locales_locale_parent_id_unique" ON "export_logistics_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "export_logistics_texts_order_parent" ON "export_logistics_texts" USING btree ("order","parent_id");
  CREATE INDEX "export_logistics_texts_locale_parent" ON "export_logistics_texts" USING btree ("locale","parent_id");
  CREATE INDEX "_export_logistics_v_version_lists_brief_fields_order_idx" ON "_export_logistics_v_version_lists_brief_fields" USING btree ("_order");
  CREATE INDEX "_export_logistics_v_version_lists_brief_fields_parent_id_idx" ON "_export_logistics_v_version_lists_brief_fields" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_export_logistics_v_version_lists_brief_fields_locales_local" ON "_export_logistics_v_version_lists_brief_fields_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_export_logistics_v_version_lists_delivery_steps_order_idx" ON "_export_logistics_v_version_lists_delivery_steps" USING btree ("_order");
  CREATE INDEX "_export_logistics_v_version_lists_delivery_steps_parent_id_idx" ON "_export_logistics_v_version_lists_delivery_steps" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_export_logistics_v_version_lists_delivery_steps_locales_loc" ON "_export_logistics_v_version_lists_delivery_steps_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_export_logistics_v_version_lists_packaging_order_idx" ON "_export_logistics_v_version_lists_packaging" USING btree ("_order");
  CREATE INDEX "_export_logistics_v_version_lists_packaging_parent_id_idx" ON "_export_logistics_v_version_lists_packaging" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_export_logistics_v_version_lists_packaging_locales_locale_p" ON "_export_logistics_v_version_lists_packaging_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_export_logistics_v_version_lists_incoterms_order_idx" ON "_export_logistics_v_version_lists_incoterms" USING btree ("_order");
  CREATE INDEX "_export_logistics_v_version_lists_incoterms_parent_id_idx" ON "_export_logistics_v_version_lists_incoterms" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_export_logistics_v_version_lists_incoterms_locales_locale_p" ON "_export_logistics_v_version_lists_incoterms_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_export_logistics_v_version_version__status_idx" ON "_export_logistics_v" USING btree ("version__status");
  CREATE INDEX "_export_logistics_v_created_at_idx" ON "_export_logistics_v" USING btree ("created_at");
  CREATE INDEX "_export_logistics_v_updated_at_idx" ON "_export_logistics_v" USING btree ("updated_at");
  CREATE INDEX "_export_logistics_v_snapshot_idx" ON "_export_logistics_v" USING btree ("snapshot");
  CREATE INDEX "_export_logistics_v_published_locale_idx" ON "_export_logistics_v" USING btree ("published_locale");
  CREATE INDEX "_export_logistics_v_latest_idx" ON "_export_logistics_v" USING btree ("latest");
  CREATE UNIQUE INDEX "_export_logistics_v_locales_locale_parent_id_unique" ON "_export_logistics_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_export_logistics_v_texts_order_parent" ON "_export_logistics_v_texts" USING btree ("order","parent_id");
  CREATE INDEX "_export_logistics_v_texts_locale_parent" ON "_export_logistics_v_texts" USING btree ("locale","parent_id");
  CREATE INDEX "header_lists_navigation_order_idx" ON "header_lists_navigation" USING btree ("_order");
  CREATE INDEX "header_lists_navigation_parent_id_idx" ON "header_lists_navigation" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "header_lists_navigation_locales_locale_parent_id_unique" ON "header_lists_navigation_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "header__status_idx" ON "header" USING btree ("_status");
  CREATE UNIQUE INDEX "header_locales_locale_parent_id_unique" ON "header_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_header_v_version_lists_navigation_order_idx" ON "_header_v_version_lists_navigation" USING btree ("_order");
  CREATE INDEX "_header_v_version_lists_navigation_parent_id_idx" ON "_header_v_version_lists_navigation" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_header_v_version_lists_navigation_locales_locale_parent_id_" ON "_header_v_version_lists_navigation_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_header_v_version_version__status_idx" ON "_header_v" USING btree ("version__status");
  CREATE INDEX "_header_v_created_at_idx" ON "_header_v" USING btree ("created_at");
  CREATE INDEX "_header_v_updated_at_idx" ON "_header_v" USING btree ("updated_at");
  CREATE INDEX "_header_v_snapshot_idx" ON "_header_v" USING btree ("snapshot");
  CREATE INDEX "_header_v_published_locale_idx" ON "_header_v" USING btree ("published_locale");
  CREATE INDEX "_header_v_latest_idx" ON "_header_v" USING btree ("latest");
  CREATE UNIQUE INDEX "_header_v_locales_locale_parent_id_unique" ON "_header_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "footer_lists_columns_order_idx" ON "footer_lists_columns" USING btree ("_order");
  CREATE INDEX "footer_lists_columns_parent_id_idx" ON "footer_lists_columns" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "footer_lists_columns_locales_locale_parent_id_unique" ON "footer_lists_columns_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "footer_lists_company_links_order_idx" ON "footer_lists_company_links" USING btree ("_order");
  CREATE INDEX "footer_lists_company_links_parent_id_idx" ON "footer_lists_company_links" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "footer_lists_company_links_locales_locale_parent_id_unique" ON "footer_lists_company_links_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "footer__status_idx" ON "footer" USING btree ("_status");
  CREATE UNIQUE INDEX "footer_locales_locale_parent_id_unique" ON "footer_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_footer_v_version_lists_columns_order_idx" ON "_footer_v_version_lists_columns" USING btree ("_order");
  CREATE INDEX "_footer_v_version_lists_columns_parent_id_idx" ON "_footer_v_version_lists_columns" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_footer_v_version_lists_columns_locales_locale_parent_id_uni" ON "_footer_v_version_lists_columns_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_footer_v_version_lists_company_links_order_idx" ON "_footer_v_version_lists_company_links" USING btree ("_order");
  CREATE INDEX "_footer_v_version_lists_company_links_parent_id_idx" ON "_footer_v_version_lists_company_links" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_footer_v_version_lists_company_links_locales_locale_parent_" ON "_footer_v_version_lists_company_links_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_footer_v_version_version__status_idx" ON "_footer_v" USING btree ("version__status");
  CREATE INDEX "_footer_v_created_at_idx" ON "_footer_v" USING btree ("created_at");
  CREATE INDEX "_footer_v_updated_at_idx" ON "_footer_v" USING btree ("updated_at");
  CREATE INDEX "_footer_v_snapshot_idx" ON "_footer_v" USING btree ("snapshot");
  CREATE INDEX "_footer_v_published_locale_idx" ON "_footer_v" USING btree ("published_locale");
  CREATE INDEX "_footer_v_latest_idx" ON "_footer_v" USING btree ("latest");
  CREATE UNIQUE INDEX "_footer_v_locales_locale_parent_id_unique" ON "_footer_v_locales" USING btree ("_locale","_parent_id");`);
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "home_lists_who_we_are" CASCADE;
  DROP TABLE "home_lists_who_we_are_locales" CASCADE;
  DROP TABLE "home_lists_trust_indicators" CASCADE;
  DROP TABLE "home_lists_trust_indicators_locales" CASCADE;
  DROP TABLE "home_lists_advantages" CASCADE;
  DROP TABLE "home_lists_advantages_locales" CASCADE;
  DROP TABLE "home_lists_industries" CASCADE;
  DROP TABLE "home_lists_industries_locales" CASCADE;
  DROP TABLE "home_lists_custom_steps" CASCADE;
  DROP TABLE "home_lists_custom_steps_locales" CASCADE;
  DROP TABLE "home" CASCADE;
  DROP TABLE "home_locales" CASCADE;
  DROP TABLE "home_texts" CASCADE;
  DROP TABLE "_home_v_version_lists_who_we_are" CASCADE;
  DROP TABLE "_home_v_version_lists_who_we_are_locales" CASCADE;
  DROP TABLE "_home_v_version_lists_trust_indicators" CASCADE;
  DROP TABLE "_home_v_version_lists_trust_indicators_locales" CASCADE;
  DROP TABLE "_home_v_version_lists_advantages" CASCADE;
  DROP TABLE "_home_v_version_lists_advantages_locales" CASCADE;
  DROP TABLE "_home_v_version_lists_industries" CASCADE;
  DROP TABLE "_home_v_version_lists_industries_locales" CASCADE;
  DROP TABLE "_home_v_version_lists_custom_steps" CASCADE;
  DROP TABLE "_home_v_version_lists_custom_steps_locales" CASCADE;
  DROP TABLE "_home_v" CASCADE;
  DROP TABLE "_home_v_locales" CASCADE;
  DROP TABLE "_home_v_texts" CASCADE;
  DROP TABLE "products_landing_lists_finder_facets" CASCADE;
  DROP TABLE "products_landing_lists_finder_facets_locales" CASCADE;
  DROP TABLE "products_landing_lists_document_tiers" CASCADE;
  DROP TABLE "products_landing_lists_document_tiers_locales" CASCADE;
  DROP TABLE "products_landing_lists_closing_routes" CASCADE;
  DROP TABLE "products_landing_lists_closing_routes_locales" CASCADE;
  DROP TABLE "products_landing" CASCADE;
  DROP TABLE "products_landing_locales" CASCADE;
  DROP TABLE "products_landing_texts" CASCADE;
  DROP TABLE "_products_landing_v_version_lists_finder_facets" CASCADE;
  DROP TABLE "_products_landing_v_version_lists_finder_facets_locales" CASCADE;
  DROP TABLE "_products_landing_v_version_lists_document_tiers" CASCADE;
  DROP TABLE "_products_landing_v_version_lists_document_tiers_locales" CASCADE;
  DROP TABLE "_products_landing_v_version_lists_closing_routes" CASCADE;
  DROP TABLE "_products_landing_v_version_lists_closing_routes_locales" CASCADE;
  DROP TABLE "_products_landing_v" CASCADE;
  DROP TABLE "_products_landing_v_locales" CASCADE;
  DROP TABLE "_products_landing_v_texts" CASCADE;
  DROP TABLE "export_logistics_lists_brief_fields" CASCADE;
  DROP TABLE "export_logistics_lists_brief_fields_locales" CASCADE;
  DROP TABLE "export_logistics_lists_delivery_steps" CASCADE;
  DROP TABLE "export_logistics_lists_delivery_steps_locales" CASCADE;
  DROP TABLE "export_logistics_lists_packaging" CASCADE;
  DROP TABLE "export_logistics_lists_packaging_locales" CASCADE;
  DROP TABLE "export_logistics_lists_incoterms" CASCADE;
  DROP TABLE "export_logistics_lists_incoterms_locales" CASCADE;
  DROP TABLE "export_logistics" CASCADE;
  DROP TABLE "export_logistics_locales" CASCADE;
  DROP TABLE "export_logistics_texts" CASCADE;
  DROP TABLE "_export_logistics_v_version_lists_brief_fields" CASCADE;
  DROP TABLE "_export_logistics_v_version_lists_brief_fields_locales" CASCADE;
  DROP TABLE "_export_logistics_v_version_lists_delivery_steps" CASCADE;
  DROP TABLE "_export_logistics_v_version_lists_delivery_steps_locales" CASCADE;
  DROP TABLE "_export_logistics_v_version_lists_packaging" CASCADE;
  DROP TABLE "_export_logistics_v_version_lists_packaging_locales" CASCADE;
  DROP TABLE "_export_logistics_v_version_lists_incoterms" CASCADE;
  DROP TABLE "_export_logistics_v_version_lists_incoterms_locales" CASCADE;
  DROP TABLE "_export_logistics_v" CASCADE;
  DROP TABLE "_export_logistics_v_locales" CASCADE;
  DROP TABLE "_export_logistics_v_texts" CASCADE;
  DROP TABLE "header_lists_navigation" CASCADE;
  DROP TABLE "header_lists_navigation_locales" CASCADE;
  DROP TABLE "header" CASCADE;
  DROP TABLE "header_locales" CASCADE;
  DROP TABLE "_header_v_version_lists_navigation" CASCADE;
  DROP TABLE "_header_v_version_lists_navigation_locales" CASCADE;
  DROP TABLE "_header_v" CASCADE;
  DROP TABLE "_header_v_locales" CASCADE;
  DROP TABLE "footer_lists_columns" CASCADE;
  DROP TABLE "footer_lists_columns_locales" CASCADE;
  DROP TABLE "footer_lists_company_links" CASCADE;
  DROP TABLE "footer_lists_company_links_locales" CASCADE;
  DROP TABLE "footer" CASCADE;
  DROP TABLE "footer_locales" CASCADE;
  DROP TABLE "_footer_v_version_lists_columns" CASCADE;
  DROP TABLE "_footer_v_version_lists_columns_locales" CASCADE;
  DROP TABLE "_footer_v_version_lists_company_links" CASCADE;
  DROP TABLE "_footer_v_version_lists_company_links_locales" CASCADE;
  DROP TABLE "_footer_v" CASCADE;
  DROP TABLE "_footer_v_locales" CASCADE;
  DROP TYPE "public"."enum_home_lists_who_we_are_source";
  DROP TYPE "public"."enum_home_lists_trust_indicators_source";
  DROP TYPE "public"."enum_home_lists_advantages_source";
  DROP TYPE "public"."enum_home_lists_industries_source";
  DROP TYPE "public"."enum_home_lists_custom_steps_source";
  DROP TYPE "public"."enum_home_seo_twitter_card_type";
  DROP TYPE "public"."enum_home_status";
  DROP TYPE "public"."enum__home_v_version_lists_who_we_are_source";
  DROP TYPE "public"."enum__home_v_version_lists_trust_indicators_source";
  DROP TYPE "public"."enum__home_v_version_lists_advantages_source";
  DROP TYPE "public"."enum__home_v_version_lists_industries_source";
  DROP TYPE "public"."enum__home_v_version_lists_custom_steps_source";
  DROP TYPE "public"."enum__home_v_version_seo_twitter_card_type";
  DROP TYPE "public"."enum__home_v_version_status";
  DROP TYPE "public"."enum__home_v_published_locale";
  DROP TYPE "public"."enum_products_landing_lists_finder_facets_source";
  DROP TYPE "public"."enum_products_landing_lists_document_tiers_source";
  DROP TYPE "public"."enum_products_landing_lists_closing_routes_source";
  DROP TYPE "public"."enum_products_landing_seo_twitter_card_type";
  DROP TYPE "public"."enum_products_landing_status";
  DROP TYPE "public"."enum__products_landing_v_version_lists_finder_facets_source";
  DROP TYPE "public"."enum__products_landing_v_version_lists_document_tiers_source";
  DROP TYPE "public"."enum__products_landing_v_version_lists_closing_routes_source";
  DROP TYPE "public"."enum__products_landing_v_version_seo_twitter_card_type";
  DROP TYPE "public"."enum__products_landing_v_version_status";
  DROP TYPE "public"."enum__products_landing_v_published_locale";
  DROP TYPE "public"."enum_export_logistics_lists_brief_fields_source";
  DROP TYPE "public"."enum_export_logistics_lists_delivery_steps_source";
  DROP TYPE "public"."enum_export_logistics_lists_packaging_source";
  DROP TYPE "public"."enum_export_logistics_lists_incoterms_source";
  DROP TYPE "public"."enum_export_logistics_seo_twitter_card_type";
  DROP TYPE "public"."enum_export_logistics_status";
  DROP TYPE "public"."enum__export_logistics_v_version_lists_brief_fields_source";
  DROP TYPE "public"."enum__export_logistics_v_version_lists_delivery_steps_source";
  DROP TYPE "public"."enum__export_logistics_v_version_lists_packaging_source";
  DROP TYPE "public"."enum__export_logistics_v_version_lists_incoterms_source";
  DROP TYPE "public"."enum__export_logistics_v_version_seo_twitter_card_type";
  DROP TYPE "public"."enum__export_logistics_v_version_status";
  DROP TYPE "public"."enum__export_logistics_v_published_locale";
  DROP TYPE "public"."enum_header_lists_navigation_source";
  DROP TYPE "public"."enum_header_status";
  DROP TYPE "public"."enum__header_v_version_lists_navigation_source";
  DROP TYPE "public"."enum__header_v_version_status";
  DROP TYPE "public"."enum__header_v_published_locale";
  DROP TYPE "public"."enum_footer_lists_columns_source";
  DROP TYPE "public"."enum_footer_lists_company_links_source";
  DROP TYPE "public"."enum_footer_status";
  DROP TYPE "public"."enum__footer_v_version_lists_columns_source";
  DROP TYPE "public"."enum__footer_v_version_lists_company_links_source";
  DROP TYPE "public"."enum__footer_v_version_status";
  DROP TYPE "public"."enum__footer_v_published_locale";`);
}
