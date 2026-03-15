-- Hotel PMS — Post-migration SQL
-- Run after Prisma migrations to add advanced PostgreSQL constraints

-- Enable btree_gist extension for date range exclusion constraints
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Anti-double-booking constraint at the database level
-- Prevents overlapping reservations for the same room within a tenant
-- This is a defense-in-depth measure (application also checks)
ALTER TABLE reservations ADD CONSTRAINT IF NOT EXISTS no_overlapping_reservations
  EXCLUDE USING GIST (
    tenant_id WITH =,
    room_id WITH =,
    daterange(check_in, check_out) WITH &&
  )
  WHERE (status NOT IN ('CANCELLED', 'NO_SHOW'));

-- Enable Row Level Security on key tables (defense-in-depth)
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (applied when using SET app.current_tenant_id)
CREATE POLICY IF NOT EXISTS tenant_isolation_rooms ON rooms
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY IF NOT EXISTS tenant_isolation_reservations ON reservations
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY IF NOT EXISTS tenant_isolation_invoices ON invoices
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY IF NOT EXISTS tenant_isolation_payments ON payments
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY IF NOT EXISTS tenant_isolation_articles ON articles
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY IF NOT EXISTS tenant_isolation_stock_movements ON stock_movements
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Index for performance on common queries
CREATE INDEX IF NOT EXISTS idx_reservations_availability 
  ON reservations (tenant_id, room_id, check_in, check_out) 
  WHERE status NOT IN ('CANCELLED', 'NO_SHOW');

CREATE INDEX IF NOT EXISTS idx_articles_low_stock 
  ON articles (tenant_id, current_stock, minimum_stock) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_invoices_overdue 
  ON invoices (tenant_id, status, due_date) 
  WHERE status = 'ISSUED';
