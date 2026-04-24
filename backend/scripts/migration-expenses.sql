-- Migration: add expenses table (décaissement / cash disbursement)
-- Creates the ExpenseCategory enum and the expenses table with soft-delete,
-- indexes for reporting aggregation, and FKs mirroring the ORM model.

DO $$ BEGIN
  CREATE TYPE "ExpenseCategory" AS ENUM (
    'SUPPLIES',
    'SALARY',
    'UTILITIES',
    'RENT',
    'MAINTENANCE',
    'TRANSPORT',
    'MARKETING',
    'TAXES',
    'OTHER'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "expenses" (
  "id"                UUID              NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"         UUID              NOT NULL,
  "establishment_id"  UUID              NOT NULL,
  "amount"            DECIMAL(12, 2)    NOT NULL,
  "reason"            TEXT              NOT NULL,
  "category"          "ExpenseCategory" NOT NULL DEFAULT 'OTHER',
  "payment_method"    "PaymentMethod"   NOT NULL DEFAULT 'CASH',
  "supplier_id"       UUID,
  "operation_date"    TIMESTAMP(3)      NOT NULL,
  "notes"             TEXT,
  "performed_by_id"   UUID              NOT NULL,
  "deleted_at"        TIMESTAMP(3),
  "deleted_by_id"     UUID,
  "created_at"        TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "expenses"
    ADD CONSTRAINT "expenses_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "expenses"
    ADD CONSTRAINT "expenses_establishment_id_fkey"
    FOREIGN KEY ("establishment_id") REFERENCES "establishments"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "expenses"
    ADD CONSTRAINT "expenses_supplier_id_fkey"
    FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "expenses"
    ADD CONSTRAINT "expenses_performed_by_id_fkey"
    FOREIGN KEY ("performed_by_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "expenses"
    ADD CONSTRAINT "expenses_deleted_by_id_fkey"
    FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "expenses_tenant_id_idx"
  ON "expenses"("tenant_id");

CREATE INDEX IF NOT EXISTS "expenses_tenant_id_establishment_id_operation_date_idx"
  ON "expenses"("tenant_id", "establishment_id", "operation_date");

CREATE INDEX IF NOT EXISTS "expenses_tenant_id_establishment_id_deleted_at_idx"
  ON "expenses"("tenant_id", "establishment_id", "deleted_at");
