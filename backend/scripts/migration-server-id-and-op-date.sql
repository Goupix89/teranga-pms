-- Migration: order.server_id + operation dates for stock & invoices
-- Safe to re-run: uses IF NOT EXISTS where possible.

BEGIN;

-- 1. orders.server_id: attribution to a server (e.g. when POS creates on behalf)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS server_id TEXT;

-- FK only if not already created
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'orders_server_id_fkey'
      AND table_name = 'orders'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_server_id_fkey
      FOREIGN KEY (server_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS orders_tenant_id_server_id_idx ON orders(tenant_id, server_id);

-- 2. stock_movements.occurred_at: business date of the movement (vs system created_at)
ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS occurred_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill existing rows so occurred_at mirrors created_at (best-known business date)
UPDATE stock_movements SET occurred_at = created_at WHERE occurred_at = created_at OR occurred_at > created_at;

-- 3. invoices.issue_date: business issue date (vs system created_at)
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS issue_date TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE invoices SET issue_date = created_at WHERE issue_date = created_at OR issue_date > created_at;

COMMIT;
