-- Migration: add Article.trackStock flag + StockMovement.orderId link
-- Default false (do not decrement) to preserve existing behavior for prepared
-- dishes. Rétrofit existing rows with current_stock > 0 OR minimum_stock > 0
-- (best-effort signal that the establishment actually tracks inventory for
-- this article).

ALTER TABLE "articles"
  ADD COLUMN IF NOT EXISTS "track_stock" BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE "articles"
SET "track_stock" = TRUE
WHERE "current_stock" > 0 OR "minimum_stock" > 0;

ALTER TABLE "stock_movements"
  ADD COLUMN IF NOT EXISTS "order_id" UUID;

ALTER TABLE "stock_movements"
  DROP CONSTRAINT IF EXISTS "stock_movements_order_id_fkey";

ALTER TABLE "stock_movements"
  ADD CONSTRAINT "stock_movements_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "stock_movements_tenant_id_order_id_idx"
  ON "stock_movements"("tenant_id", "order_id");
