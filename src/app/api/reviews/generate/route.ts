import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { reviews, products, shops } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { generateBatch, type GeneratedReview } from '@/lib/review-generator'

export async function POST(request: NextRequest) {
  // Check authentication
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { productId, count = 1 } = body

    if (!productId) {
      return NextResponse.json(
        { error: 'productId is required' },
        { status: 400 }
      )
    }

    if (count < 1 || count > 10) {
      return NextResponse.json(
        { error: 'count must be between 1 and 10' },
        { status: 400 }
      )
    }

    // Get product with shop info
    const [productResult] = await db
      .select({
        product: products,
        shop: shops
      })
      .from(products)
      .leftJoin(shops, eq(products.shopId, shops.id))
      .where(eq(products.id, productId))
      .limit(1)

    if (!productResult?.product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    const { product, shop } = productResult

    if (!shop) {
      return NextResponse.json(
        { error: 'Shop not found for product' },
        { status: 404 }
      )
    }

    // Get existing reviews for this product (for inspiration)
    const existingReviews = await db
      .select({ content: reviews.content })
      .from(reviews)
      .where(eq(reviews.productId, productId))
      .limit(5)

    // Generate reviews
    const generatedReviews = await generateBatch(
      {
        product: {
          name: product.name,
          description: product.description || undefined,
          category: product.category || undefined,
          price: product.price ? parseFloat(product.price) : undefined
        },
        shop: {
          name: shop.name,
          domain: shop.domain
        },
        existingReviews: existingReviews.map(r => r.content)
      },
      count
    )

    // Store reviews in database
    const insertedReviews = await db
      .insert(reviews)
      .values(
        generatedReviews.map((review: GeneratedReview) => ({
          shopId: shop.id,
          productId: product.id,
          status: 'pending',
          reviewerName: review.reviewerName,
          rating: review.rating,
          title: review.title,
          content: review.content,
          createdAt: new Date(),
          updatedAt: new Date()
        }))
      )
      .returning()

    return NextResponse.json({
      success: true,
      generated: generatedReviews.length,
      reviews: insertedReviews
    })
  } catch (error) {
    console.error('Error generating reviews:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate reviews' },
      { status: 500 }
    )
  }
}
