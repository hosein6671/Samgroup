-- Seeds the confirmed Phase 1 locale set (en/fa/ar) so a freshly migrated
-- `sam_platform` never has an empty `locales` table.
--
-- apps/web treats GET /api/v1/locales as a build hard dependency with no
-- fallback (frontend/FRONTEND_ARCHITECTURE.md §2): an empty locale set fails
-- the build/serve outright with LocaleContractError. `platform-migrate`
-- (deploy/deploy.sh) applies every migration in this directory but never ran
-- prisma/seed.ts, so a first deploy against an empty database migrated the
-- schema and then could not bring `web` up at all — verified end-to-end
-- against an isolated empty database.
--
-- ON CONFLICT is a no-op guard, not a refresh path. `prisma/seed.ts` stays the
-- place to edit existing rows (idempotent upsert, run manually); a migration
-- runs exactly once per environment and must never silently overwrite a later
-- administrative change to name/order/active state.
INSERT INTO "locales" ("id", "code", "name", "native_name", "direction", "is_active", "is_default", "sort_order")
VALUES
  (gen_random_uuid(), 'en', 'English', 'English', 'ltr', true, true, 1),
  (gen_random_uuid(), 'fa', 'Persian', 'فارسی', 'rtl', true, false, 2),
  (gen_random_uuid(), 'ar', 'Arabic', 'العربية', 'rtl', true, false, 3)
ON CONFLICT ("code") DO NOTHING;
