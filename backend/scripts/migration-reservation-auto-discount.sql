-- Migration: split manual and auto discount references, track amounts separately
-- A reservation (or invoice) can now carry BOTH a manually-picked discount rule
-- AND an automatically-applied rule (Owner rules flagged autoApply=true) at the same time.
-- Apply with:  docker exec -i <pg_container> psql -U <user> -d <db> < migration-reservation-auto-discount.sql

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS auto_discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auto_discount_rule_id UUID;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS auto_discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auto_discount_rule_id UUID;

ALTER TABLE reservations
  DROP CONSTRAINT IF EXISTS reservations_auto_discount_rule_id_fkey,
  ADD CONSTRAINT reservations_auto_discount_rule_id_fkey
    FOREIGN KEY (auto_discount_rule_id) REFERENCES discount_rules(id) ON DELETE SET NULL;

ALTER TABLE invoices
  DROP CONSTRAINT IF EXISTS invoices_auto_discount_rule_id_fkey,
  ADD CONSTRAINT invoices_auto_discount_rule_id_fkey
    FOREIGN KEY (auto_discount_rule_id) REFERENCES discount_rules(id) ON DELETE SET NULL;
