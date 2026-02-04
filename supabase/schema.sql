-- ASH Review Platform Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Shops table
CREATE TABLE IF NOT EXISTS shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  domain TEXT NOT NULL,
  lightspeed_api_key TEXT,
  lightspeed_api_secret TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Products table (synced from Lightspeed)
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  price DECIMAL(10,2),
  image_url TEXT,
  review_count INT DEFAULT 0,
  avg_rating DECIMAL(2,1),
  priority INT DEFAULT 0,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(shop_id, external_id)
);

-- Reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'posted', 'failed')),
  reviewer_name TEXT NOT NULL,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title TEXT,
  content TEXT NOT NULL,
  source_reviews TEXT[], -- IDs of reviews used as inspiration
  scheduled_at TIMESTAMPTZ,
  posted_at TIMESTAMPTZ,
  external_id TEXT, -- Lightspeed review ID after posting
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Review generation jobs
CREATE TABLE IF NOT EXISTS generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  status TEXT DEFAULT 'pending',
  target_count INT DEFAULT 1,
  generated_count INT DEFAULT 0,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_products_shop_id ON products(shop_id);
CREATE INDEX IF NOT EXISTS idx_reviews_shop_id ON reviews(shop_id);
CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_shop_id ON generation_jobs(shop_id);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS update_shops_updated_at ON shops;
CREATE TRIGGER update_shops_updated_at
    BEFORE UPDATE ON shops
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_reviews_updated_at ON reviews;
CREATE TRIGGER update_reviews_updated_at
    BEFORE UPDATE ON reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) - Enable for production
-- ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE products ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE generation_jobs ENABLE ROW LEVEL SECURITY;

-- Basic policies (customize based on your auth setup)
-- CREATE POLICY "Allow authenticated users to read shops" ON shops FOR SELECT TO authenticated USING (true);
-- CREATE POLICY "Allow authenticated users to insert shops" ON shops FOR INSERT TO authenticated WITH CHECK (true);
-- CREATE POLICY "Allow authenticated users to update shops" ON shops FOR UPDATE TO authenticated USING (true);
