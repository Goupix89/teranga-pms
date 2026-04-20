-- Per-item kitchen status: each OrderItem tracks its own lifecycle so that
-- items added to an already-in-progress/served order can re-enter the PENDING
-- column without resetting the items that are already being cooked/served.

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS status "OrderStatus" NOT NULL DEFAULT 'PENDING';

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill: existing items inherit the parent order's current status.
UPDATE order_items oi
SET status = o.status
FROM orders o
WHERE oi.order_id = o.id
  AND oi.status = 'PENDING';

CREATE INDEX IF NOT EXISTS order_items_order_id_status_idx
  ON order_items(order_id, status);
