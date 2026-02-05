/**
 * Post approved reviews to Lightspeed shops
 * 
 * Usage: npx tsx scripts/post-reviews.ts
 */

import fs from 'fs'
import path from 'path'

// Load .env.local
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

// Cache for review customers per shop
const shopCustomerCache = new Map<string, number>()

async function getOrCreateReviewCustomer(
  client: any,
  shopId: string,
  reviewerName: string
): Promise<number> {
  // Check cache first
  if (shopCustomerCache.has(shopId)) {
    return shopCustomerCache.get(shopId)!
  }
  
  // Try to find existing "reviews" customer
  try {
    const customers = await client.getCustomers(100)
    const reviewCustomer = customers.find(
      (c: any) => c.email?.includes('reviews@') || c.firstname?.toLowerCase() === 'review'
    )
    if (reviewCustomer) {
      shopCustomerCache.set(shopId, reviewCustomer.id)
      return reviewCustomer.id
    }
  } catch (e) {
    console.log('  ⚠️ Could not fetch customers:', e)
  }
  
  // Create a new review customer
  try {
    const randomId = Math.random().toString(36).substring(7)
    const customer = await client.createCustomer(
      `reviews-${randomId}@ash-reviews.local`,
      reviewerName,
      ''
    )
    shopCustomerCache.set(shopId, customer.id)
    return customer.id
  } catch (e) {
    console.log('  ⚠️ Could not create customer:', e)
    throw e
  }
}

async function main() {
  const { db } = await import('../src/lib/db')
  const { shops, products, reviews } = await import('../src/lib/schema')
  const { eq, and, lte, or, isNull } = await import('drizzle-orm')
  const { createLightspeedClient, LightspeedError } = await import('../src/lib/lightspeed')

  console.log('🚀 Starting review posting...\n')

  const now = new Date()

  // Get all approved reviews that are scheduled for now or earlier
  const reviewsToPost = await db
    .select({
      review: reviews,
      product: products,
      shop: shops,
    })
    .from(reviews)
    .innerJoin(products, eq(reviews.productId, products.id))
    .innerJoin(shops, eq(reviews.shopId, shops.id))
    .where(
      and(
        eq(reviews.status, 'approved'),
        or(
          lte(reviews.scheduledAt, now),
          isNull(reviews.scheduledAt)
        )
      )
    )
    .limit(20)

  console.log(`Found ${reviewsToPost.length} reviews to post\n`)

  let posted = 0
  let failed = 0

  for (const { review, product, shop } of reviewsToPost) {
    console.log(`\n📝 Posting review for ${product.name.substring(0, 40)}... on ${shop.name}`)

    if (!shop.lightspeedApiKey || !shop.lightspeedApiSecret) {
      console.log(`  ⚠️ No API credentials for ${shop.name}, marking as failed`)
      await db.update(reviews).set({ 
        status: 'failed',
        error: 'No API credentials'
      }).where(eq(reviews.id, review.id))
      failed++
      continue
    }

    try {
      const client = createLightspeedClient(
        shop.lightspeedApiKey,
        shop.lightspeedApiSecret,
        'nl'
      )

      // Get or create customer for reviews
      const customerId = await getOrCreateReviewCustomer(
        client,
        shop.id,
        review.reviewerName || 'Klant'
      )
      console.log(`  Using customer ID: ${customerId}`)
      
      // Combine title and content for the review
      const reviewContent = review.title 
        ? `${review.title}\n\n${review.content}`
        : review.content
        
      // Post review to Lightspeed
      await client.createReview(Number(product.externalId), {
        score: review.rating,
        name: review.reviewerName || 'Anonymous',
        content: reviewContent,
        isVisible: true,
        customerId: customerId,
      })

      // Mark as posted
      await db.update(reviews).set({ 
        status: 'posted',
        postedAt: new Date(),
        error: null
      }).where(eq(reviews.id, review.id))

      console.log(`  ✅ Posted successfully!`)
      posted++
    } catch (error) {
      let errorMsg = 'Unknown error'
      if (error instanceof LightspeedError) {
        errorMsg = `${error.message} - ${JSON.stringify(error.response)}`
      } else if (error instanceof Error) {
        errorMsg = error.message
      }
      console.log(`  ❌ Failed: ${errorMsg}`)
      
      await db.update(reviews).set({ 
        status: 'failed',
        error: errorMsg.substring(0, 500)
      }).where(eq(reviews.id, review.id))
      failed++
    }
  }

  console.log(`\n✨ Done! Posted: ${posted}, Failed: ${failed}`)
  process.exit(0)
}

main().catch(console.error)
