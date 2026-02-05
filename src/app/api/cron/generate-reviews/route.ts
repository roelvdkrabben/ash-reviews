import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { shops, products, reviews } from '@/lib/schema'
import { eq, and } from 'drizzle-orm'
import { selectProductsAvoidingRecent, type ProductSelection } from '@/lib/product-selector'
import { scheduleReviewsForShop, getGeneratedCountThisWeek } from '@/lib/review-scheduler'
import { generateBatch, type GeneratedReview } from '@/lib/review-generator'

interface ShopGenerationResult {
  shopId: string
  shopName: string
  needed: number
  generated: number
  scheduled: number
  products: string[]
  error?: string
}

/**
 * Cron job endpoint for auto-generating reviews
 * 
 * Vercel Cron: Runs daily at 4:00 AM UTC
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

  // Check if GEMINI_API_KEY is configured
  if (!process.env.GEMINI_API_KEY) {
    console.error('[CRON] GEMINI_API_KEY is not configured')
    return NextResponse.json(
      { error: 'GEMINI_API_KEY not configured' },
      { status: 500 }
    )
  }

  try {
    console.log('[CRON] Starting review generation...')
    
    // Get all shops with auto_generate = true
    const autoShops = await db
      .select()
      .from(shops)
      .where(eq(shops.autoGenerate, 'true'))

    console.log(`[CRON] Found ${autoShops.length} shops with auto-generate enabled`)

    const results: ShopGenerationResult[] = []

    for (const shop of autoShops) {
      console.log(`[CRON] Processing shop: ${shop.name}`)
      
      try {
        // Calculate how many reviews needed this week
        const reviewsPerWeek = shop.reviewsPerWeek ?? 10
        const generatedThisWeek = await getGeneratedCountThisWeek(shop.id)
        const needed = Math.max(0, reviewsPerWeek - generatedThisWeek)

        console.log(`[CRON] Shop ${shop.name}: ${generatedThisWeek}/${reviewsPerWeek} generated this week, need ${needed} more`)

        if (needed === 0) {
          results.push({
            shopId: shop.id,
            shopName: shop.name,
            needed: 0,
            generated: 0,
            scheduled: 0,
            products: [],
          })
          continue
        }

        // Select products for review generation
        const selectedProducts = await selectProductsAvoidingRecent(shop.id, needed)
        
        if (selectedProducts.length === 0) {
          console.log(`[CRON] No suitable products found for ${shop.name}`)
          results.push({
            shopId: shop.id,
            shopName: shop.name,
            needed,
            generated: 0,
            scheduled: 0,
            products: [],
            error: 'No suitable products found',
          })
          continue
        }

        console.log(`[CRON] Selected ${selectedProducts.length} products for ${shop.name}`)

        // Generate reviews for each product
        const generatedReviewIds: string[] = []
        const productNames: string[] = []

        for (const selection of selectedProducts) {
          try {
            // Get full product details
            const [product] = await db
              .select()
              .from(products)
              .where(eq(products.id, selection.productId))
              .limit(1)

            if (!product) {
              console.log(`[CRON] Product not found: ${selection.productId}`)
              continue
            }

            // Get existing reviews for inspiration
            const existingReviews = await db
              .select({ content: reviews.content })
              .from(reviews)
              .where(
                and(
                  eq(reviews.productId, product.id),
                  eq(reviews.status, 'imported')
                )
              )
              .limit(5)

            // Generate 1 review per product
            const generated = await generateBatch(
              {
                product: {
                  name: product.name,
                  description: product.description || undefined,
                  category: product.category || undefined,
                  price: product.price ? parseFloat(product.price) : undefined,
                },
                shop: {
                  name: shop.name,
                  domain: shop.domain,
                },
                existingReviews: existingReviews.map(r => r.content),
              },
              1 // One review per product
            )

            if (generated.length === 0) {
              console.log(`[CRON] Failed to generate review for ${product.name}`)
              continue
            }

            // Save review to database
            const [savedReview] = await db
              .insert(reviews)
              .values({
                shopId: shop.id,
                productId: product.id,
                status: 'pending',
                reviewerName: generated[0].reviewerName,
                rating: generated[0].rating,
                title: generated[0].title,
                content: generated[0].content,
                createdAt: new Date(),
                updatedAt: new Date(),
              })
              .returning()

            generatedReviewIds.push(savedReview.id)
            productNames.push(product.name)
            console.log(`[CRON] Generated review for ${product.name}`)

            // Small delay between generations to respect rate limits
            await new Promise(resolve => setTimeout(resolve, 500))
          } catch (error) {
            console.error(`[CRON] Error generating review for ${selection.productName}:`, error)
          }
        }

        // Schedule the generated reviews
        if (generatedReviewIds.length > 0) {
          await scheduleReviewsForShop(shop.id, generatedReviewIds)
        }

        results.push({
          shopId: shop.id,
          shopName: shop.name,
          needed,
          generated: generatedReviewIds.length,
          scheduled: generatedReviewIds.length,
          products: productNames,
        })

        console.log(`[CRON] Completed ${shop.name}: ${generatedReviewIds.length} reviews generated and scheduled`)
      } catch (error) {
        console.error(`[CRON] Error processing shop ${shop.name}:`, error)
        results.push({
          shopId: shop.id,
          shopName: shop.name,
          needed: 0,
          generated: 0,
          scheduled: 0,
          products: [],
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    // Summary
    const summary = {
      totalShops: results.length,
      successfulShops: results.filter(r => !r.error).length,
      totalReviewsGenerated: results.reduce((sum, r) => sum + r.generated, 0),
      totalReviewsScheduled: results.reduce((sum, r) => sum + r.scheduled, 0),
      results,
    }

    console.log('[CRON] Generation complete:', {
      shops: summary.totalShops,
      successful: summary.successfulShops,
      generated: summary.totalReviewsGenerated,
      scheduled: summary.totalReviewsScheduled,
    })

    return NextResponse.json({
      success: true,
      message: `Generated ${summary.totalReviewsGenerated} reviews for ${summary.successfulShops} shops`,
      ...summary,
    })
  } catch (error) {
    console.error('[CRON] Generation failed:', error)
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
