CREATE TABLE "admin_audit_events" (
  "id" UUID NOT NULL,
  "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actor_id" UUID,
  "subject_id" UUID,
  "event" VARCHAR(64) NOT NULL,
  "outcome" VARCHAR(16) NOT NULL,
  "http_status" INTEGER,
  CONSTRAINT "admin_audit_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "admin_audit_events_outcome_check" CHECK ("outcome" IN ('success', 'failure')),
  CONSTRAINT "admin_audit_events_status_check" CHECK ("http_status" IS NULL OR "http_status" BETWEEN 100 AND 599)
);
CREATE INDEX "admin_audit_events_occurred_at_id_idx" ON "admin_audit_events" ("occurred_at", "id");
CREATE INDEX "admin_audit_events_actor_id_occurred_at_idx" ON "admin_audit_events" ("actor_id", "occurred_at");
