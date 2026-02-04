import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { shops, products, reviews } from '@/lib/schema'
import { eq, and } from 'drizzle-orm'
import { selectProductsAvoidingRecent } from '@/lib/product-selector'
import { scheduleReviewsForShop, getGeneratedCountThisWeek } from '@/lib/review-scheduler'
import { generateBatch } from '@/lib/review-generator'

/**
 * Manual trigger for review generation for a specific shop
 * POST /api/shops/[id]/generate
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: shopId } = await params

  // Check if ANTHROPIC_API_KEY is configured
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY niet geconfigureerd' },
      { status: 500 }
    )
  }

  try {
    // Get shop
    const [shop] = await db
      .select()
      .from(shops)
      .where(eq(shops.id, shopId))
      .limit(1)

    if (!shop) {
      return NextResponse.json({ error: 'Shop niet gevonden' }, { status: 404 })
    }

    // Get count parameter (default 1)
    const body = await request.json().catch(() => ({}))
    const count = Math.min(Math.max(body.count || 1, 1), 10) // 1-10

    console.log(`[GENERATE] Manual trigger for ${shop.name}, count: ${count}`)

    // Select products
    const selectedProducts = await selectProductsAvoidingRecent(shopId, count)
    
    if (selectedProducts.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Geen geschikte producten gevonden',
        generated: 0,
        scheduled: 0,
      })
    }

    // Generate reviews
    const generatedReviewIds: string[] = []
    const productNames: string[] = []
    const errors: string[] = []

    for (const selection of selectedProducts) {
      try {
        const [product] = await db
          .select()
          .from(products)
          .where(eq(products.id, selection.productId))
          .limit(1)

        if (!product) continue

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

        // Generate 1 review
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
          1
        )

        if (generated.length === 0) {
          errors.push(`Kon geen review genereren voor ${product.name}`)
          continue
        }

        // Save review
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

        // Small delay
        await new Promise(resolve => setTimeout(resolve, 300))
      } catch (error) {
        errors.push(`Fout bij ${selection.productName}: ${error instanceof Error ? error.message : 'onbekend'}`)
      }
    }

    // Schedule reviews
    if (generatedReviewIds.length > 0) {
      await scheduleReviewsForShop(shopId, generatedReviewIds)
    }

    return NextResponse.json({
      success: true,
      message: `${generatedReviewIds.length} review(s) gegenereerd`,
      generated: generatedReviewIds.length,
      scheduled: generatedReviewIds.length,
      products: productNames,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('[GENERATE] Error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Generatie mislukt' 
      },
      { status: 500 }
    )
  }
}
