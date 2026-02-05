-- Migration: Add url field to products table
-- Run this in Neon SQL Editor

ALTER TABLE products ADD COLUMN IF NOT EXISTS url TEXT;

-- Verify
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'products' AND column_name = 'url';
