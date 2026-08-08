-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('admin', 'content_manager', 'sales_expert', 'customer');

-- CreateEnum
CREATE TYPE "inquiry_type" AS ENUM ('product_inquiry', 'request_a_quote', 'customized_solution', 'export_and_logistics', 'distribution_partnership', 'general_inquiry', 'sample_request');

-- CreateEnum
CREATE TYPE "newsletter_status" AS ENUM ('pending', 'confirmed', 'unsubscribed');

-- CreateEnum
CREATE TYPE "locale_direction" AS ENUM ('ltr', 'rtl');

-- CreateEnum
CREATE TYPE "translation_status" AS ENUM ('machine_draft', 'human_reviewed');

-- CreateEnum
CREATE TYPE "media_type" AS ENUM ('image', 'file', 'video', 'document');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "user_role" NOT NULL,
    "organization_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "parent_id" UUID,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category_id" UUID NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "specifications" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "unit" TEXT,

    CONSTRAINT "specifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media" (
    "id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "type" "media_type" NOT NULL,
    "alt_text" TEXT,
    "owner_type" TEXT,
    "owner_id" UUID,

    CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_posts" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category_id" UUID NOT NULL,
    "author_id" UUID,
    "published_at" TIMESTAMPTZ(6),

    CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "blog_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_tags" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "blog_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_post_tags" (
    "blog_post_id" UUID NOT NULL,
    "blog_tag_id" UUID NOT NULL,

    CONSTRAINT "blog_post_tags_pkey" PRIMARY KEY ("blog_post_id","blog_tag_id")
);

-- CreateTable
CREATE TABLE "inquiries" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "assigned_to_id" UUID,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "industry" TEXT NOT NULL,
    "inquiry_type" "inquiry_type" NOT NULL,
    "products_of_interest" TEXT[],
    "related_product_id" UUID,
    "required_quantity" TEXT,
    "destination_country_port" TEXT,
    "preferred_incoterm" TEXT,
    "message" TEXT,
    "attachment_media_id" UUID,
    "consent_given" BOOLEAN NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_formulation_requests" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "assigned_to_id" UUID,
    "company_name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "product_or_application" TEXT NOT NULL,
    "required_specifications" TEXT NOT NULL,
    "estimated_quantity" TEXT,
    "packaging_requirements" TEXT,
    "additional_information" TEXT,
    "destination_country" TEXT,
    "preferred_incoterm" TEXT,
    "attachment_media_id" UUID,
    "consent_given" BOOLEAN NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "custom_formulation_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "distributor_applications" (
    "id" UUID NOT NULL,
    "assigned_to_id" UUID,
    "company_name" TEXT NOT NULL,
    "contact_person" TEXT NOT NULL,
    "country_territory" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "website" TEXT,
    "years_in_business" TEXT,
    "current_product_lines" TEXT,
    "sectors_served" TEXT,
    "estimated_annual_volume" TEXT,
    "storage_capacity" TEXT,
    "brands_currently_distributed" TEXT,
    "additional_information" TEXT,
    "consent_given" BOOLEAN NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "distributor_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_applications" (
    "id" UUID NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "job_opening_key" TEXT,
    "cover_letter" TEXT,
    "cv_media_id" UUID,
    "consent_given" BOOLEAN NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "download_requests" (
    "id" UUID NOT NULL,
    "assigned_to_id" UUID,
    "name" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "document_key" TEXT NOT NULL,
    "consent_given" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "download_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "newsletter_subscriptions" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "status" "newsletter_status" NOT NULL DEFAULT 'pending',
    "source" TEXT NOT NULL,
    "consent_given" BOOLEAN NOT NULL,
    "confirmed_at" TIMESTAMPTZ(6),
    "unsubscribed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "newsletter_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seo_meta" (
    "id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "locale" TEXT NOT NULL,
    "meta_title" TEXT,
    "meta_description" TEXT,
    "canonical_url" TEXT,
    "og_title" TEXT,
    "og_description" TEXT,
    "og_image_url" TEXT,
    "twitter_card_type" TEXT,
    "twitter_title" TEXT,
    "twitter_description" TEXT,
    "twitter_image_url" TEXT,
    "robots_index" BOOLEAN NOT NULL DEFAULT true,
    "robots_follow" BOOLEAN NOT NULL DEFAULT true,
    "keywords" TEXT[],
    "structured_data_override" JSONB,
    "social_image_id" UUID,

    CONSTRAINT "seo_meta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "redirects" (
    "id" UUID NOT NULL,
    "from_path" TEXT NOT NULL,
    "to_path" TEXT NOT NULL,
    "status_code" INTEGER NOT NULL DEFAULT 301,
    "locale" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "redirects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locales" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "native_name" TEXT NOT NULL,
    "direction" "locale_direction" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "locales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_translations" (
    "id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "locale" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "translation_status" "translation_status" NOT NULL,

    CONSTRAINT "content_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "status_history" (
    "id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT NOT NULL,
    "changed_by_id" UUID,
    "changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_organization_id_idx" ON "users"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_parent_id_idx" ON "categories"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE INDEX "products_category_id_idx" ON "products"("category_id");

-- CreateIndex
CREATE INDEX "specifications_product_id_idx" ON "specifications"("product_id");

-- CreateIndex
CREATE INDEX "media_owner_type_owner_id_idx" ON "media"("owner_type", "owner_id");

-- CreateIndex
CREATE INDEX "media_type_idx" ON "media"("type");

-- CreateIndex
CREATE UNIQUE INDEX "blog_posts_slug_key" ON "blog_posts"("slug");

-- CreateIndex
CREATE INDEX "blog_posts_category_id_idx" ON "blog_posts"("category_id");

-- CreateIndex
CREATE INDEX "blog_posts_author_id_idx" ON "blog_posts"("author_id");

-- CreateIndex
CREATE INDEX "blog_posts_published_at_idx" ON "blog_posts"("published_at");

-- CreateIndex
CREATE UNIQUE INDEX "blog_categories_slug_key" ON "blog_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "blog_tags_slug_key" ON "blog_tags"("slug");

-- CreateIndex
CREATE INDEX "blog_post_tags_blog_tag_id_idx" ON "blog_post_tags"("blog_tag_id");

-- CreateIndex
CREATE INDEX "inquiries_status_idx" ON "inquiries"("status");

-- CreateIndex
CREATE INDEX "inquiries_assigned_to_id_idx" ON "inquiries"("assigned_to_id");

-- CreateIndex
CREATE INDEX "inquiries_inquiry_type_idx" ON "inquiries"("inquiry_type");

-- CreateIndex
CREATE INDEX "inquiries_created_at_idx" ON "inquiries"("created_at");

-- CreateIndex
CREATE INDEX "inquiries_user_id_idx" ON "inquiries"("user_id");

-- CreateIndex
CREATE INDEX "inquiries_related_product_id_idx" ON "inquiries"("related_product_id");

-- CreateIndex
CREATE INDEX "inquiries_attachment_media_id_idx" ON "inquiries"("attachment_media_id");

-- CreateIndex
CREATE INDEX "custom_formulation_requests_status_idx" ON "custom_formulation_requests"("status");

-- CreateIndex
CREATE INDEX "custom_formulation_requests_assigned_to_id_idx" ON "custom_formulation_requests"("assigned_to_id");

-- CreateIndex
CREATE INDEX "custom_formulation_requests_created_at_idx" ON "custom_formulation_requests"("created_at");

-- CreateIndex
CREATE INDEX "custom_formulation_requests_user_id_idx" ON "custom_formulation_requests"("user_id");

-- CreateIndex
CREATE INDEX "custom_formulation_requests_attachment_media_id_idx" ON "custom_formulation_requests"("attachment_media_id");

-- CreateIndex
CREATE INDEX "distributor_applications_status_idx" ON "distributor_applications"("status");

-- CreateIndex
CREATE INDEX "distributor_applications_assigned_to_id_idx" ON "distributor_applications"("assigned_to_id");

-- CreateIndex
CREATE INDEX "distributor_applications_created_at_idx" ON "distributor_applications"("created_at");

-- CreateIndex
CREATE INDEX "job_applications_status_idx" ON "job_applications"("status");

-- CreateIndex
CREATE INDEX "job_applications_created_at_idx" ON "job_applications"("created_at");

-- CreateIndex
CREATE INDEX "job_applications_job_opening_key_idx" ON "job_applications"("job_opening_key");

-- CreateIndex
CREATE INDEX "job_applications_cv_media_id_idx" ON "job_applications"("cv_media_id");

-- CreateIndex
CREATE INDEX "download_requests_assigned_to_id_idx" ON "download_requests"("assigned_to_id");

-- CreateIndex
CREATE INDEX "download_requests_created_at_idx" ON "download_requests"("created_at");

-- CreateIndex
CREATE INDEX "download_requests_email_idx" ON "download_requests"("email");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_subscriptions_email_key" ON "newsletter_subscriptions"("email");

-- CreateIndex
CREATE INDEX "newsletter_subscriptions_status_idx" ON "newsletter_subscriptions"("status");

-- CreateIndex
CREATE INDEX "newsletter_subscriptions_created_at_idx" ON "newsletter_subscriptions"("created_at");

-- CreateIndex
CREATE INDEX "newsletter_subscriptions_locale_idx" ON "newsletter_subscriptions"("locale");

-- CreateIndex
CREATE INDEX "seo_meta_entity_type_entity_id_idx" ON "seo_meta"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "seo_meta_social_image_id_idx" ON "seo_meta"("social_image_id");

-- CreateIndex
CREATE INDEX "seo_meta_locale_idx" ON "seo_meta"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "seo_meta_entity_type_entity_id_locale_key" ON "seo_meta"("entity_type", "entity_id", "locale");

-- CreateIndex
CREATE INDEX "redirects_from_path_is_active_idx" ON "redirects"("from_path", "is_active");

-- CreateIndex
CREATE INDEX "redirects_locale_idx" ON "redirects"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "redirects_from_path_locale_key" ON "redirects"("from_path", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "locales_code_key" ON "locales"("code");

-- CreateIndex
CREATE INDEX "locales_is_active_sort_order_idx" ON "locales"("is_active", "sort_order");

-- CreateIndex
CREATE INDEX "content_translations_entity_type_entity_id_idx" ON "content_translations"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "content_translations_locale_translation_status_idx" ON "content_translations"("locale", "translation_status");

-- CreateIndex
CREATE UNIQUE INDEX "content_translations_entity_type_entity_id_locale_field_key" ON "content_translations"("entity_type", "entity_id", "locale", "field");

-- CreateIndex
CREATE INDEX "status_history_entity_type_entity_id_idx" ON "status_history"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "status_history_changed_by_id_idx" ON "status_history"("changed_by_id");

-- CreateIndex
CREATE INDEX "status_history_changed_at_idx" ON "status_history"("changed_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "specifications" ADD CONSTRAINT "specifications_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "blog_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_post_tags" ADD CONSTRAINT "blog_post_tags_blog_post_id_fkey" FOREIGN KEY ("blog_post_id") REFERENCES "blog_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_post_tags" ADD CONSTRAINT "blog_post_tags_blog_tag_id_fkey" FOREIGN KEY ("blog_tag_id") REFERENCES "blog_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_related_product_id_fkey" FOREIGN KEY ("related_product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_attachment_media_id_fkey" FOREIGN KEY ("attachment_media_id") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_formulation_requests" ADD CONSTRAINT "custom_formulation_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_formulation_requests" ADD CONSTRAINT "custom_formulation_requests_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_formulation_requests" ADD CONSTRAINT "custom_formulation_requests_attachment_media_id_fkey" FOREIGN KEY ("attachment_media_id") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distributor_applications" ADD CONSTRAINT "distributor_applications_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_cv_media_id_fkey" FOREIGN KEY ("cv_media_id") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "download_requests" ADD CONSTRAINT "download_requests_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "newsletter_subscriptions" ADD CONSTRAINT "newsletter_subscriptions_locale_fkey" FOREIGN KEY ("locale") REFERENCES "locales"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seo_meta" ADD CONSTRAINT "seo_meta_locale_fkey" FOREIGN KEY ("locale") REFERENCES "locales"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seo_meta" ADD CONSTRAINT "seo_meta_social_image_id_fkey" FOREIGN KEY ("social_image_id") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redirects" ADD CONSTRAINT "redirects_locale_fkey" FOREIGN KEY ("locale") REFERENCES "locales"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_translations" ADD CONSTRAINT "content_translations_locale_fkey" FOREIGN KEY ("locale") REFERENCES "locales"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_history" ADD CONSTRAINT "status_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Hand-added partial unique indexes.
--
-- These are NOT generated by Prisma: its schema language cannot express a
-- partial (WHERE-filtered) unique index. Each one closes an integrity gap that
-- would otherwise have to be enforced in application code, where it fails under
-- concurrency. Approved as part of the schema plan.
--
-- If schema.prisma is ever re-diffed from empty, these must be re-appended —
-- `prisma migrate diff` will not reproduce them.
-- ---------------------------------------------------------------------------

-- Exactly one default locale. Locale.isDefault drives locale resolution and
-- x-default hreflang; two defaults would make both non-deterministic.
CREATE UNIQUE INDEX "locales_single_default" ON "locales" ("is_default") WHERE "is_default";

-- Global redirects must be unique by path. The generated
-- redirects_from_path_locale_key does not constrain rows where locale IS NULL,
-- because PostgreSQL treats NULLs as distinct — so without this, unlimited
-- conflicting global redirects can exist for the same from_path.
CREATE UNIQUE INDEX "redirects_from_path_global" ON "redirects" ("from_path") WHERE "locale" IS NULL;

-- A localized slug must be unique within its locale and entity type. Without
-- this, two products could share an Arabic slug and /ar/products/<slug> would
-- resolve ambiguously.
CREATE UNIQUE INDEX "content_translations_unique_slug" ON "content_translations" ("entity_type", "locale", "value") WHERE "field" = 'slug';
