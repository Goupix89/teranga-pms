-- Migration: add Client + DiscountRule models, client/discount FK on reservations/invoices/orders
-- Apply on prod with:  docker compose -f docker-compose.prod.yml exec postgres psql -U <user> -d <db> -f /path/to/this.sql
-- Or regenerate via:   npx prisma migrate dev --name add_clients_and_discounts  (dev env only)

BEGIN;

-- 1. Client table
CREATE TABLE IF NOT EXISTS "clients" (
  "id"         TEXT PRIMARY KEY,
  "tenant_id"  TEXT NOT NULL,
  "first_name" TEXT NOT NULL,
  "last_name"  TEXT NOT NULL,
  "email"      TEXT,
  "phone"      TEXT,
  "source"     TEXT NOT NULL DEFAULT 'DIRECT',
  "notes"      TEXT,
  "tags"       JSONB NOT NULL DEFAULT '[]'::jsonb,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "clients_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "clients_tenant_email_key" ON "clients"("tenant_id", "email") WHERE "email" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "clients_tenant_idx" ON "clients"("tenant_id");
CREATE INDEX IF NOT EXISTS "clients_tenant_phone_idx" ON "clients"("tenant_id", "phone");

-- 2. DiscountRule table
CREATE TABLE IF NOT EXISTS "discount_rules" (
  "id"          TEXT PRIMARY KEY,
  "tenant_id"   TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "type"        TEXT NOT NULL,
  "value"       DECIMAL(10,2) NOT NULL,
  "applies_to"  TEXT NOT NULL,
  "min_nights"  INTEGER,
  "min_amount"  DECIMAL(10,2),
  "auto_apply"  BOOLEAN NOT NULL DEFAULT false,
  "is_active"   BOOLEAN NOT NULL DEFAULT true,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "discount_rules_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
);
CREATE INDEX IF NOT EXISTS "discount_rules_tenant_idx" ON "discount_rules"("tenant_id");

-- 3. Reservations — add client_id, discount_rule_id, discount_amount
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "client_id" TEXT;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "discount_rule_id" TEXT;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "discount_amount" DECIMAL(10,2) NOT NULL DEFAULT 0;
DO $$ BEGIN
  ALTER TABLE "reservations" ADD CONSTRAINT "reservations_client_fk" FOREIGN KEY ("client_id") REFERENCES "clients"("id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "reservations" ADD CONSTRAINT "reservations_discount_fk" FOREIGN KEY ("discount_rule_id") REFERENCES "discount_rules"("id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "reservations_tenant_client_idx" ON "reservations"("tenant_id", "client_id");

-- 4. Invoices — add client_id, discount_rule_id, discount_amount
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "client_id" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "discount_rule_id" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "discount_amount" DECIMAL(10,2) NOT NULL DEFAULT 0;
DO $$ BEGIN
  ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_fk" FOREIGN KEY ("client_id") REFERENCES "clients"("id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "invoices" ADD CONSTRAINT "invoices_discount_fk" FOREIGN KEY ("discount_rule_id") REFERENCES "discount_rules"("id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "invoices_tenant_client_idx" ON "invoices"("tenant_id", "client_id");

-- 5. Orders — add discount_rule_id, discount_amount
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "discount_rule_id" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "discount_amount" DECIMAL(10,2) NOT NULL DEFAULT 0;
DO $$ BEGIN
  ALTER TABLE "orders" ADD CONSTRAINT "orders_discount_fk" FOREIGN KEY ("discount_rule_id") REFERENCES "discount_rules"("id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMIT;
