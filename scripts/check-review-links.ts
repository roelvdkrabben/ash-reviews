/**
 * Diagnostic script: Check how many reviews are missing product links
 * Run with: npx tsx scripts/check-review-links.ts
 */

import { readFileSync } from 'fs'
import { join } from 'path'

// Load .env.local manually
const envPath = join(process.cwd(), '.env.local')
try {
  const envContent = readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match) {
      process.env[match[1].trim()] = match[2].trim()
    }
  }
} catch {}

import { neon } from '@neondatabase/serverless'

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set.')
    process.exit(1)
  }

  const sql = neon(process.env.DATABASE_URL)

  console.log('🔍 Checking review-product links...\n')

  // Total counts
  const reviews = await sql`SELECT COUNT(*) as count FROM reviews`
  const unlinked = await sql`SELECT COUNT(*) as count FROM reviews WHERE product_id IS NULL`
  const linked = await sql`SELECT COUNT(*) as count FROM reviews WHERE product_id IS NOT NULL`
  const products = await sql`SELECT COUNT(*) as count FROM products`
  const shops = await sql`SELECT COUNT(*) as count FROM shops`

  console.log(`Shops: ${shops[0]?.count}`)
  console.log(`Products: ${products[0]?.count}`)
  console.log(`Reviews total: ${reviews[0]?.count}`)
  console.log(`  - WITH product link: ${linked[0]?.count}`)
  console.log(`  - WITHOUT product link: ${unlinked[0]?.count}`)

  // Shops list
  console.log('\n📊 Shops:')
  const shopList = await sql`SELECT id, name, slug FROM shops ORDER BY name`
  for (const shop of shopList) {
    const shopProducts = await sql`SELECT COUNT(*) as count FROM products WHERE shop_id = ${shop.id}`
    const shopReviews = await sql`SELECT COUNT(*) as count FROM reviews WHERE shop_id = ${shop.id}`
    const shopUnlinked = await sql`SELECT COUNT(*) as count FROM reviews WHERE shop_id = ${shop.id} AND product_id IS NULL`
    console.log(`  ${shop.name}:`)
    console.log(`    Products: ${shopProducts[0]?.count}`)
    console.log(`    Reviews: ${shopReviews[0]?.count} (${shopUnlinked[0]?.count} unlinked)`)
  }

  // Sample unlinked
  if (Number(unlinked[0]?.count) > 0) {
    console.log('\n🔎 Sample unlinked reviews:')
    const sample = await sql`
      SELECT r.id, r.external_id, r.reviewer_name, s.name as shop_name
      FROM reviews r
      JOIN shops s ON r.shop_id = s.id
      WHERE r.product_id IS NULL
      LIMIT 5
    `
    for (const row of sample) {
      console.log(`  Review ${row.external_id} by "${row.reviewer_name}" (${row.shop_name})`)
    }
  }
}

main().catch(console.error)
