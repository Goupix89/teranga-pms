-- Add operation_date to orders, default to created_at for existing rows.
-- Idempotent: safe to re-run.

ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "operation_date" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill existing rows: operation_date = created_at (so historical reports
-- don't shift). Only updates rows where operation_date equals the column
-- default (i.e. wasn't set by the new INSERTs).
UPDATE "orders"
SET "operation_date" = "created_at"
WHERE "operation_date" >= NOW() - INTERVAL '1 minute'
  AND "created_at" < NOW() - INTERVAL '1 minute';

CREATE INDEX IF NOT EXISTS "orders_tenant_id_operation_date_idx"
  ON "orders"("tenant_id", "operation_date");
