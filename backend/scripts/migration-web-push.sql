-- Add Web Push subscription columns to device_tokens
ALTER TABLE device_tokens
  ADD COLUMN IF NOT EXISTS subscription_auth   TEXT,
  ADD COLUMN IF NOT EXISTS subscription_p256dh TEXT;
