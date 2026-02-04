// Run with: $env:DATABASE_URL="..."; npx tsx scripts/migrate-phase2.ts
import { db } from '../src/lib/db'
import { sql } from 'drizzle-orm'

async function migrate() {
  console.log('Running Phase 2 migration: Shop settings for review workflow...')

  try {
    // Add new columns for review workflow settings
    await db.execute(sql`
      ALTER TABLE shops ADD COLUMN IF NOT EXISTS reviews_per_week INTEGER DEFAULT 10;
    `)
    console.log('✓ Added reviews_per_week')

    await db.execute(sql`
      ALTER TABLE shops ADD COLUMN IF NOT EXISTS active_days TEXT[] DEFAULT '{tue,wed,thu,sat}';
    `)
    console.log('✓ Added active_days')

    await db.execute(sql`
      ALTER TABLE shops ADD COLUMN IF NOT EXISTS time_slot_start TEXT DEFAULT '09:00';
    `)
    console.log('✓ Added time_slot_start')

    await db.execute(sql`
      ALTER TABLE shops ADD COLUMN IF NOT EXISTS time_slot_end TEXT DEFAULT '21:00';
    `)
    console.log('✓ Added time_slot_end')

    await db.execute(sql`
      ALTER TABLE shops ADD COLUMN IF NOT EXISTS min_hours_between INTEGER DEFAULT 4;
    `)
    console.log('✓ Added min_hours_between')

    await db.execute(sql`
      ALTER TABLE shops ADD COLUMN IF NOT EXISTS priority_bestsellers INTEGER DEFAULT 60;
    `)
    console.log('✓ Added priority_bestsellers')

    await db.execute(sql`
      ALTER TABLE shops ADD COLUMN IF NOT EXISTS priority_no_reviews INTEGER DEFAULT 25;
    `)
    console.log('✓ Added priority_no_reviews')

    await db.execute(sql`
      ALTER TABLE shops ADD COLUMN IF NOT EXISTS priority_stale INTEGER DEFAULT 15;
    `)
    console.log('✓ Added priority_stale')

    await db.execute(sql`
      ALTER TABLE shops ADD COLUMN IF NOT EXISTS stale_days_threshold INTEGER DEFAULT 30;
    `)
    console.log('✓ Added stale_days_threshold')

    await db.execute(sql`
      ALTER TABLE shops ADD COLUMN IF NOT EXISTS auto_generate TEXT DEFAULT 'false';
    `)
    console.log('✓ Added auto_generate')

    console.log('\n✅ Phase 2 migration completed successfully!')
  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }

  process.exit(0)
}

migrate()
