import { readFileSync } from 'fs'
import { join } from 'path'
import { neon } from '@neondatabase/serverless'

// Load .env.local
const envPath = join(process.cwd(), '.env.local')
const envContent = readFileSync(envPath, 'utf-8')
for (const line of envContent.split(/\r?\n/)) {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match) {
    process.env[match[1].trim()] = match[2].trim()
  }
}

const sql = neon(process.env.DATABASE_URL!)

async function check() {
  const shopId = '8ad4a9ac-9825-4f7e-a540-ef488bd1e6d3' // Accu Service Holland
  
  console.log('=== Recent Reviews Check (last 7 days) ===\n')
  
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 7)
  
  const recentReviews = await sql`
    SELECT COUNT(DISTINCT product_id) as count 
    FROM reviews 
    WHERE shop_id = ${shopId} 
    AND created_at > ${cutoff.toISOString()}
  `
  
  const totalProducts = await sql`SELECT COUNT(*) as count FROM products WHERE shop_id = ${shopId}`
  
  console.log(`Shop: Accu Service Holland`)
  console.log(`Total products: ${totalProducts[0].count}`)
  console.log(`Products with reviews in last 7 days: ${recentReviews[0].count}`)
  console.log(`Available for generation: ${Number(totalProducts[0].count) - Number(recentReviews[0].count)}`)
  
  // Check product scores
  console.log('\n=== Product Score Test ===\n')
  
  const productsWithStats = await sql`
    SELECT 
      p.id, 
      p.name,
      p.review_count,
      (SELECT MAX(created_at) FROM reviews r WHERE r.product_id = p.id AND r.status IN ('posted', 'imported')) as last_review
    FROM products p
    WHERE p.shop_id = ${shopId}
    LIMIT 10
  `
  
  console.log('Sample products:')
  for (const p of productsWithStats) {
    console.log(`  - ${p.name}: ${p.review_count} reviews, last: ${p.last_review || 'never'}`)
  }
}

check()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1) })
