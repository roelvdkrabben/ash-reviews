-- Migration: Add sync timestamp columns to shops table
-- Date: 2025-01-26

-- Add last_products_sync column
ALTER TABLE shops 
ADD COLUMN IF NOT EXISTS last_products_sync TIMESTAMP WITH TIME ZONE;

-- Add last_reviews_sync column
ALTER TABLE shops 
ADD COLUMN IF NOT EXISTS last_reviews_sync TIMESTAMP WITH TIME ZONE;

-- Optional: Create index for querying shops that need sync
CREATE INDEX IF NOT EXISTS shops_last_products_sync_idx ON shops (last_products_sync);
CREATE INDEX IF NOT EXISTS shops_last_reviews_sync_idx ON shops (last_reviews_sync);
