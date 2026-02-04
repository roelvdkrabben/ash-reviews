import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { productQueue, products, shops, reviews } from '@/lib/schema'
import { eq, and, asc, desc } from 'drizzle-orm'
import { generateBatch, type GeneratedReview } from '@/lib/review-generator'

// POST /api/queue/process - Process next items in queue
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const { ids, limit = 5 } = body as { ids?: string[], limit?: number }

    let itemsToProcess: Array<{
      queueItem: typeof productQueue.$inferSelect
      product: typeof products.$inferSelect | null
      shop: typeof shops.$inferSelect | null
    }> = []

    if (ids && ids.length > 0) {
      // Process specific items
      for (const id of ids) {
        const [item] = await db
          .select({
            queueItem: productQueue,
            product: products,
            shop: shops,
          })
          .from(productQueue)
          .leftJoin(products, eq(productQueue.productId, products.id))
          .leftJoin(shops, eq(productQueue.shopId, shops.id))
          .where(eq(productQueue.id, id))
          .limit(1)
        
        if (item) {
          itemsToProcess.push(item)
        }
      }
    } else {
      // Get next pending items by priority
      itemsToProcess = await db
        .select({
          queueItem: productQueue,
          product: products,
          shop: shops,
        })
        .from(productQueue)
        .leftJoin(products, eq(productQueue.productId, products.id))
        .leftJoin(shops, eq(productQueue.shopId, shops.id))
        .where(eq(productQueue.status, 'pending'))
        .orderBy(desc(productQueue.priority), asc(productQueue.addedAt))
        .limit(limit)
    }

    if (itemsToProcess.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No items to process',
        processed: 0 
      })
    }

    const results: Array<{
      queueId: string
      productId: string
      productName: string
      status: 'completed' | 'failed'
      reviewId?: string
      error?: string
    }> = []

    // Process each item
    for (const { queueItem, product, shop } of itemsToProcess) {
      if (!product || !shop) {
        // Mark as failed if product or shop is missing
        await db
          .update(productQueue)
          .set({ 
            status: 'failed', 
            error: 'Product or shop not found',
            completedAt: new Date()
          })
          .where(eq(productQueue.id, queueItem.id))
        
        results.push({
          queueId: queueItem.id,
          productId: queueItem.productId,
          productName: 'Unknown',
          status: 'failed',
          error: 'Product or shop not found'
        })
        continue
      }

      // Mark as generating
      await db
        .update(productQueue)
        .set({ 
          status: 'generating',
          startedAt: new Date()
        })
        .where(eq(productQueue.id, queueItem.id))

      try {
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

        // Generate review
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
          1  // Generate 1 review per queue item
        )

        if (generatedReviews.length === 0) {
          throw new Error('No review generated')
        }

        // Store the review
        const [newReview] = await db
          .insert(reviews)
          .values({
            shopId: shop.id,
            productId: product.id,
            status: 'pending',
            reviewerName: generatedReviews[0].reviewerName,
            rating: generatedReviews[0].rating,
            title: generatedReviews[0].title,
            content: generatedReviews[0].content,
            createdAt: new Date(),
            updatedAt: new Date()
          })
          .returning()

        // Mark queue item as completed
        await db
          .update(productQueue)
          .set({ 
            status: 'completed',
            completedAt: new Date(),
            reviewId: newReview.id
          })
          .where(eq(productQueue.id, queueItem.id))

        results.push({
          queueId: queueItem.id,
          productId: product.id,
          productName: product.name,
          status: 'completed',
          reviewId: newReview.id
        })

      } catch (error) {
        // Mark as failed
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        
        await db
          .update(productQueue)
          .set({ 
            status: 'failed',
            completedAt: new Date(),
            error: errorMessage
          })
          .where(eq(productQueue.id, queueItem.id))

        results.push({
          queueId: queueItem.id,
          productId: product.id,
          productName: product.name,
          status: 'failed',
          error: errorMessage
        })
      }
    }

    const succeeded = results.filter(r => r.status === 'completed').length
    const failed = results.filter(r => r.status === 'failed').length

    return NextResponse.json({
      success: true,
      processed: results.length,
      succeeded,
      failed,
      results
    })
  } catch (error) {
    console.error('Error processing queue:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process queue' },
      { status: 500 }
    )
  }
}
