import { readFileSync } from 'fs'
import { join } from 'path'
import { neon } from '@neondatabase/serverless'

// Load .env.local
const envPath = join(process.cwd(), '.env.local')
const envContent = readFileSync(envPath, 'utf-8')
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match) {
    process.env[match[1].trim()] = match[2].trim()
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set')
    process.exit(1)
  }

  const sql = neon(process.env.DATABASE_URL)
  
  console.log('Running migration: create product_queue table...')
  
  await sql`
    CREATE TABLE IF NOT EXISTS product_queue (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending',
      priority INTEGER DEFAULT 0,
      added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      started_at TIMESTAMP WITH TIME ZONE,
      completed_at TIMESTAMP WITH TIME ZONE,
      review_id UUID REFERENCES reviews(id),
      error TEXT,
      UNIQUE(shop_id, product_id, status)
    )
  `
  console.log('✅ Created product_queue table')
  
  await sql`CREATE INDEX IF NOT EXISTS idx_product_queue_shop ON product_queue(shop_id)`
  console.log('✅ Created index on shop_id')
  
  await sql`CREATE INDEX IF NOT EXISTS idx_product_queue_status ON product_queue(status)`
  console.log('✅ Created index on status')
  
  console.log('\n🎉 Migration complete!')
}

main().catch(e => {
  console.error('Migration failed:', e.message)
  process.exit(1)
})
