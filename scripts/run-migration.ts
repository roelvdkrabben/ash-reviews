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
  
  console.log('Running migration: add sync timestamps to shops...')
  
  await sql`ALTER TABLE shops ADD COLUMN IF NOT EXISTS last_products_sync TIMESTAMP WITH TIME ZONE`
  console.log('✅ Added last_products_sync')
  
  await sql`ALTER TABLE shops ADD COLUMN IF NOT EXISTS last_reviews_sync TIMESTAMP WITH TIME ZONE`
  console.log('✅ Added last_reviews_sync')
  
  console.log('\n🎉 Migration complete!')
}

main().catch(e => {
  console.error('Migration failed:', e.message)
  process.exit(1)
})
