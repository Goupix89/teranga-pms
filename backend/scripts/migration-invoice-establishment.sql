-- Add establishment_id to invoices for standalone invoices (created from Factures menu)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS establishment_id TEXT REFERENCES establishments(id);
CREATE INDEX IF NOT EXISTS idx_invoices_establishment_id ON invoices(establishment_id);
