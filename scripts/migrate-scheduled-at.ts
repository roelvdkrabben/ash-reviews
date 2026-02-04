/**
 * Migration: Add scheduled_at column to reviews table
 * 
 * Run with: npx tsx scripts/migrate-scheduled-at.ts
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { neon } from '@neondatabase/serverless'

// Load .env.local
const envPath = join(process.cwd(), '.env.local')
try {
  const envContent = readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match) {
      process.env[match[1].trim()] = match[2].trim()
    }
  }
} catch (e) {
  console.log('No .env.local found, using existing env vars')
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set')
    process.exit(1)
  }

  const sql = neon(process.env.DATABASE_URL)
  
  console.log('Running migration: add scheduled_at to reviews...')
  
  try {
    // Add scheduled_at column if it doesn't exist
    await sql`
      ALTER TABLE reviews 
      ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP WITH TIME ZONE
    `
    console.log('✅ Added scheduled_at column')

    // Create index for faster lookups
    await sql`
      CREATE INDEX IF NOT EXISTS reviews_scheduled_at_idx 
      ON reviews (scheduled_at) 
      WHERE scheduled_at IS NOT NULL
    `
    console.log('✅ Created index on scheduled_at')

    // Also ensure the status index exists for the combined query
    await sql`
      CREATE INDEX IF NOT EXISTS reviews_status_scheduled_idx 
      ON reviews (status, scheduled_at) 
      WHERE status = 'approved' AND scheduled_at IS NOT NULL
    `
    console.log('✅ Created compound index on status + scheduled_at')

    console.log('\n🎉 Migration complete!')
  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }
}

main().catch(e => {
  console.error('Migration failed:', e.message)
  process.exit(1)
})
