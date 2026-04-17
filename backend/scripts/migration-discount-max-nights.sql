-- Migration: add max_nights to discount_rules
-- Owner can now express an upper bound on nights (e.g. "3 à 5 nuits").
-- Apply with:  docker exec -i <pg_container> psql -U <user> -d <db> < migration-discount-max-nights.sql

ALTER TABLE discount_rules
  ADD COLUMN IF NOT EXISTS max_nights INTEGER;
