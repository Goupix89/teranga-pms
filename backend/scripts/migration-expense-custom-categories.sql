-- Migration: expense custom categories + bon de décaissement PDF
-- Run once on production DB

-- 1. New table for custom expense categories (per tenant)
CREATE TABLE IF NOT EXISTS "expense_custom_categories" (
  "id"         TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "tenant_id"  TEXT        NOT NULL,
  "name"       TEXT        NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "expense_custom_categories_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "expense_custom_categories_tenant_name_key" UNIQUE ("tenant_id", "name")
);

CREATE INDEX IF NOT EXISTS "expense_custom_categories_tenant_id_idx"
  ON "expense_custom_categories"("tenant_id");

ALTER TABLE "expense_custom_categories"
  ADD CONSTRAINT "expense_custom_categories_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. Add custom_category_id column to expenses
ALTER TABLE "expenses"
  ADD COLUMN IF NOT EXISTS "custom_category_id" TEXT;

ALTER TABLE "expenses"
  ADD CONSTRAINT "expenses_custom_category_id_fkey"
  FOREIGN KEY ("custom_category_id")
  REFERENCES "expense_custom_categories"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
