/**
 * Fix script: Link reviews to products via Lightspeed API (batch approach)
 * Run with: npx tsx scripts/fix-review-links.ts
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

interface Shop {
  id: string
  name: string
  lightspeed_api_key: string
  lightspeed_api_secret: string
}

interface LightspeedReview {
  id: number
  product?: {
    resource: {
      id: number
    }
  }
}

async function fetchAllLightspeedReviews(
  apiKey: string, 
  apiSecret: string
): Promise<LightspeedReview[]> {
  const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')
  const allReviews: LightspeedReview[] = []
  let page = 1
  
  while (true) {
    console.log(`    Fetching page ${page}...`)
    
    const res = await fetch(`https://api.webshopapp.com/nl/reviews.json?limit=250&page=${page}`, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    })
    
    if (!res.ok) {
      if (res.status === 429) {
        console.log(`    ⚠️ Rate limited, waiting 60s...`)
        await new Promise(r => setTimeout(r, 60000))
        continue
      }
      throw new Error(`API error ${res.status}`)
    }
    
    const data = await res.json()
    const reviews = data.reviews || []
    
    if (reviews.length === 0) break
    
    allReviews.push(...reviews)
    
    if (reviews.length < 250) break
    page++
    
    // Small delay between pages to be nice
    await new Promise(r => setTimeout(r, 500))
  }
  
  return allReviews
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set.')
    process.exit(1)
  }

  const sql = neon(process.env.DATABASE_URL)

  console.log('🔧 Fixing review-product links (batch mode)...\n')

  // Get shops with credentials
  const shops = await sql`
    SELECT id, name, lightspeed_api_key, lightspeed_api_secret 
    FROM shops 
    WHERE lightspeed_api_key IS NOT NULL
  ` as Shop[]

  let totalFixed = 0

  for (const shop of shops) {
    console.log(`\n📦 Processing ${shop.name}...`)

    // Check if there are unlinked reviews
    const unlinkedCount = await sql`
      SELECT COUNT(*) as count FROM reviews 
      WHERE shop_id = ${shop.id} AND product_id IS NULL
    `
    
    if (Number(unlinkedCount[0]?.count) === 0) {
      console.log('  ✅ No unlinked reviews')
      continue
    }

    console.log(`  ${unlinkedCount[0]?.count} unlinked reviews`)

    // Fetch ALL reviews from Lightspeed (batch, much faster)
    console.log('  Fetching reviews from Lightspeed...')
    const lsReviews = await fetchAllLightspeedReviews(
      shop.lightspeed_api_key,
      shop.lightspeed_api_secret
    )
    console.log(`  Got ${lsReviews.length} reviews from Lightspeed`)

    // Build map: external_review_id -> external_product_id
    const reviewProductMap = new Map<string, string>()
    for (const r of lsReviews) {
      if (r.product?.resource?.id) {
        reviewProductMap.set(String(r.id), String(r.product.resource.id))
      }
    }
    console.log(`  ${reviewProductMap.size} reviews have product links`)

    // Build product lookup: external_product_id -> our_product_id
    const products = await sql`
      SELECT id, external_id FROM products WHERE shop_id = ${shop.id}
    `
    const productMap = new Map(products.map(p => [String(p.external_id), p.id]))
    console.log(`  ${products.length} products in DB`)

    // Get unlinked reviews from our DB
    const unlinkedReviews = await sql`
      SELECT id, external_id FROM reviews 
      WHERE shop_id = ${shop.id} 
        AND product_id IS NULL 
        AND external_id IS NOT NULL
    `

    // Update each unlinked review
    let fixed = 0
    let notFound = 0

    for (const review of unlinkedReviews) {
      const externalProductId = reviewProductMap.get(review.external_id)
      if (!externalProductId) {
        notFound++
        continue
      }

      const productId = productMap.get(externalProductId)
      if (!productId) {
        notFound++
        continue
      }

      await sql`
        UPDATE reviews SET product_id = ${productId} WHERE id = ${review.id}
      `
      fixed++
    }

    console.log(`  ✅ Fixed: ${fixed}, Not found: ${notFound}`)
    totalFixed += fixed
  }

  console.log(`\n🎉 Done! Total fixed: ${totalFixed}`)
}

main().catch(console.error)
