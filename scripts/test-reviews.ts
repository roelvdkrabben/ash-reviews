/**
 * Generate and post 4 test reviews for all shops
 * 
 * Usage: npx tsx scripts/test-reviews.ts
 */

import fs from 'fs'
import path from 'path'

// Load .env.local manually BEFORE any other imports
const envPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const [key, ...valueParts] = line.split('=')
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').trim()
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = value.replace(/^["']|["']$/g, '')
      }
    }
  }
}

// Simple review generator (no AI, just for testing)
const testReviews = [
  {
    rating: 5,
    title: "Uitstekend product!",
    content: "Heel tevreden met mijn aankoop. Snelle levering en precies wat ik zocht. Aanrader!",
    reviewerName: "Jan de Vries"
  },
  {
    rating: 5,
    title: "Top kwaliteit",
    content: "Na lang zoeken eindelijk het juiste product gevonden. Werkt perfect en de prijs-kwaliteit is uitstekend.",
    reviewerName: "Lisa Bakker"
  },
  {
    rating: 4,
    title: "Goed product",
    content: "Doet wat het moet doen. Levering was snel en de verpakking was netjes. Zou het zeker aanraden.",
    reviewerName: "Peter Jansen"
  },
  {
    rating: 5,
    title: "Zeer tevreden",
    content: "Al meerdere keren hier besteld en nog nooit teleurgesteld. Service is top en producten zijn van goede kwaliteit.",
    reviewerName: "Maria Visser"
  }
]

async function main() {
  // Dynamic imports after env is loaded
  const { db } = await import('../src/lib/db')
  const { shops, products, reviews } = await import('../src/lib/schema')
  const { eq, and } = await import('drizzle-orm')

  console.log('🚀 Starting test review generation...\n')

  // Get all shops
  const allShops = await db.select().from(shops)
  console.log(`Found ${allShops.length} shops\n`)

  for (const shop of allShops) {
    console.log(`\n📦 Processing shop: ${shop.name}`)

    // Get random products for this shop
    const shopProducts = await db
      .select()
      .from(products)
      .where(eq(products.shopId, shop.id))
      .limit(4)

    if (shopProducts.length === 0) {
      console.log(`  ⚠️ No products found for ${shop.name}, skipping`)
      continue
    }

    console.log(`  Found ${shopProducts.length} products`)

    // Create 4 reviews (or less if fewer products)
    const reviewCount = Math.min(4, shopProducts.length)
    
    for (let i = 0; i < reviewCount; i++) {
      const product = shopProducts[i]
      const reviewData = testReviews[i]

      // Check if product already has a recent review
      const existingReview = await db
        .select()
        .from(reviews)
        .where(
          and(
            eq(reviews.productId, product.id),
            eq(reviews.shopId, shop.id)
          )
        )
        .limit(1)

      if (existingReview.length > 0) {
        console.log(`  ⏭️ Product "${product.name.substring(0, 30)}..." already has a review, skipping`)
        continue
      }

      // Create review with 'approved' status (ready to post)
      await db.insert(reviews).values({
        shopId: shop.id,
        productId: product.id,
        status: 'approved',
        rating: reviewData.rating,
        title: reviewData.title,
        content: reviewData.content,
        reviewerName: reviewData.reviewerName,
        // Schedule for immediate posting
        scheduledAt: new Date(),
      })

      console.log(`  ✅ Created review for "${product.name.substring(0, 30)}..." by ${reviewData.reviewerName}`)
    }
  }

  console.log('\n✨ Done! Reviews created with status "approved"')
  console.log('📝 To post them, trigger the post-reviews cron job or wait for the next scheduled run')
  
  process.exit(0)
}

main().catch(console.error)
