import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'fs'
import { join } from 'path'

// Load .env.local manually
const envPath = join(process.cwd(), '.env.local')
try {
  const envContent = readFileSync(envPath, 'utf-8')
  envContent.split('\n').forEach(line => {
    // Skip comments and empty lines
    if (line.startsWith('#') || !line.trim()) return
    const eqIndex = line.indexOf('=')
    if (eqIndex > 0) {
      const key = line.slice(0, eqIndex).trim()
      const value = line.slice(eqIndex + 1).trim().replace(/^["']|["']$/g, '')
      if (!process.env[key]) {
        process.env[key] = value
      }
    }
  })
} catch (e) {
  // .env.local might not exist, that's ok
  console.error('Could not read .env.local:', e)
}

async function migrate() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL not found in .env.local')
  }

  const sql = neon(process.env.DATABASE_URL)

  console.log('🚀 Running review workflow migration...')

  try {
    // Add new columns for review workflow
    await sql`
      ALTER TABLE reviews ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
    `
    console.log('✅ Added approved_at column')

    await sql`
      ALTER TABLE reviews ADD COLUMN IF NOT EXISTS approved_by TEXT;
    `
    console.log('✅ Added approved_by column')

    await sql`
      ALTER TABLE reviews ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP WITH TIME ZONE;
    `
    console.log('✅ Added rejected_at column')

    await sql`
      ALTER TABLE reviews ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
    `
    console.log('✅ Added rejection_reason column')

    // Add 'rejected' to status if not present (we use 'failed' currently, but 'rejected' is clearer)
    // Actually, let's just use 'rejected' status for rejected reviews
    console.log('')
    console.log('🎉 Migration completed successfully!')

  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  }
}

migrate()
