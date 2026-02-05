import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { shops, products, reviews } from '@/lib/schema'
import { eq, and, lte, isNotNull, sql } from 'drizzle-orm'
import { createLightspeedClient, LightspeedError } from '@/lib/lightspeed'

interface PostResult {
  reviewId: string
  productName: string
  shopName: string
  success: boolean
  lightspeedId?: string
  error?: string
}

/**
 * Cron job endpoint for auto-posting approved reviews to Lightspeed
 * 
 * Vercel Cron: Runs every 30 minutes
 * Protected by CRON_SECRET header
 */
export async function GET(request: Request) {
  // Verify cron secret (fail-closed: reject if not configured)
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    console.log('[CRON] Starting review posting...')
    
    const now = new Date()

    // Find reviews ready to post:
    // - status = 'approved'
    // - scheduled_at <= now
    // - scheduled_at is not null
    const reviewsToPost = await db
      .select({
        review: reviews,
        product: products,
        shop: shops,
      })
      .from(reviews)
      .leftJoin(products, eq(reviews.productId, products.id))
      .leftJoin(shops, eq(reviews.shopId, shops.id))
      .where(
        and(
          eq(reviews.status, 'approved'),
          isNotNull(reviews.scheduledAt),
          lte(reviews.scheduledAt, now)
        )
      )
      .limit(10) // Process max 10 at a time to respect rate limits

    console.log(`[CRON] Found ${reviewsToPost.length} reviews ready to post`)

    if (reviewsToPost.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No reviews to post',
        posted: 0,
        failed: 0,
        results: [],
      })
    }

    const results: PostResult[] = []

    for (const { review, product, shop } of reviewsToPost) {
      if (!product || !shop) {
        console.log(`[CRON] Missing product or shop for review ${review.id}`)
        results.push({
          reviewId: review.id,
          productName: 'Unknown',
          shopName: 'Unknown',
          success: false,
          error: 'Missing product or shop',
        })
        
        // Mark as failed
        await db
          .update(reviews)
          .set({
            status: 'failed',
            rejectionReason: 'Missing product or shop data',
            updatedAt: new Date(),
          })
          .where(eq(reviews.id, review.id))
        
        continue
      }

      // Check if shop has Lightspeed credentials
      if (!shop.lightspeedApiKey || !shop.lightspeedApiSecret) {
        console.log(`[CRON] Shop ${shop.name} missing Lightspeed credentials`)
        results.push({
          reviewId: review.id,
          productName: product.name,
          shopName: shop.name,
          success: false,
          error: 'Missing Lightspeed credentials',
        })
        
        // Mark as failed
        await db
          .update(reviews)
          .set({
            status: 'failed',
            rejectionReason: 'Shop missing Lightspeed credentials',
            updatedAt: new Date(),
          })
          .where(eq(reviews.id, review.id))
        
        continue
      }

      try {
        console.log(`[CRON] Posting review ${review.id} for ${product.name} to ${shop.name}`)

        // Create Lightspeed client
        const client = createLightspeedClient(
          shop.lightspeedApiKey,
          shop.lightspeedApiSecret,
          'nl'
        )

        // Get product external ID (Lightspeed product ID)
        if (!product.externalId) {
          throw new Error('Product missing external ID')
        }

        // Get customer ID from shop settings (required by Lightspeed API)
        const shopSettings = shop.settings as Record<string, unknown> || {}
        const customerId = shopSettings.reviewCustomerId as number | undefined
        
        if (!customerId) {
          throw new Error('Shop missing reviewCustomerId in settings. Run setup-review-customer.ts first.')
        }

        // Post review to Lightspeed
        const lightspeedReview = await client.createReview(
          parseInt(product.externalId, 10),
          {
            score: review.rating,
            name: review.reviewerName,
            content: review.content,
            isVisible: true,
            customerId: customerId,
          }
        )

        console.log(`[CRON] Successfully posted review, Lightspeed ID: ${lightspeedReview.id}`)

        // Update review status
        await db
          .update(reviews)
          .set({
            status: 'posted',
            postedAt: new Date(),
            externalId: String(lightspeedReview.id),
            updatedAt: new Date(),
          })
          .where(eq(reviews.id, review.id))

        // Update product review count
        await db
          .update(products)
          .set({
            reviewCount: sql`COALESCE(${products.reviewCount}, 0) + 1`,
          })
          .where(eq(products.id, product.id))

        results.push({
          reviewId: review.id,
          productName: product.name,
          shopName: shop.name,
          success: true,
          lightspeedId: String(lightspeedReview.id),
        })

        // Delay between posts to respect rate limits (300 req / 5 min = 1 per second max)
        await new Promise(resolve => setTimeout(resolve, 2000))
      } catch (error) {
        console.error(`[CRON] Failed to post review ${review.id}:`, error)

        const errorMessage = error instanceof LightspeedError
          ? `Lightspeed API error: ${error.statusCode} - ${error.message}`
          : error instanceof Error
            ? error.message
            : 'Unknown error'

        // Mark as failed
        await db
          .update(reviews)
          .set({
            status: 'failed',
            rejectionReason: errorMessage,
            updatedAt: new Date(),
          })
          .where(eq(reviews.id, review.id))

        results.push({
          reviewId: review.id,
          productName: product.name,
          shopName: shop.name,
          success: false,
          error: errorMessage,
        })

        // If rate limited, stop processing
        if (error instanceof LightspeedError && error.statusCode === 429) {
          console.log('[CRON] Rate limited, stopping batch')
          break
        }

        // Continue with other reviews after delay
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    // Summary
    const posted = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length

    console.log(`[CRON] Posting complete: ${posted} posted, ${failed} failed`)

    return NextResponse.json({
      success: true,
      message: `Posted ${posted} reviews, ${failed} failed`,
      posted,
      failed,
      results,
    })
  } catch (error) {
    console.error('[CRON] Post reviews failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// Support POST for manual triggers
export async function POST(request: Request) {
  return GET(request)
}
