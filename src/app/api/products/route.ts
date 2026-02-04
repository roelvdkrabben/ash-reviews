import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { products, reviews, productQueue } from '@/lib/schema'
import { eq, and, ilike, or, desc, sql, notInArray } from 'drizzle-orm'

// GET /api/products - List products with review stats
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const shopId = searchParams.get('shopId')
    const search = searchParams.get('search')
    const excludeInQueue = searchParams.get('excludeInQueue') === 'true'
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 200)

    const conditions = []

    // Shop filter (required)
    if (shopId) {
      conditions.push(eq(products.shopId, shopId))
    }

    // Search filter
    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`
      conditions.push(
        or(
          ilike(products.name, searchTerm),
          ilike(products.category, searchTerm)
        )
      )
    }

    // Get product IDs already in queue (pending/generating)
    let excludeIds: string[] = []
    if (excludeInQueue && shopId) {
      const queuedProducts = await db
        .select({ productId: productQueue.productId })
        .from(productQueue)
        .where(
          and(
            eq(productQueue.shopId, shopId),
            or(
              eq(productQueue.status, 'pending'),
              eq(productQueue.status, 'generating')
            )
          )
        )
      excludeIds = queuedProducts.map(q => q.productId).filter((id): id is string => id !== null)
      
      if (excludeIds.length > 0) {
        conditions.push(notInArray(products.id, excludeIds))
      }
    }

    // Query with review count
    const productList = await db
      .select({
        id: products.id,
        name: products.name,
        imageUrl: products.imageUrl,
        category: products.category,
        price: products.price,
        shopId: products.shopId,
        reviewCount: sql<number>`(SELECT COUNT(*) FROM ${reviews} WHERE ${reviews.productId} = ${products.id})`.as('review_count'),
        lastReviewedAt: sql<string | null>`(SELECT MAX(${reviews.createdAt}) FROM ${reviews} WHERE ${reviews.productId} = ${products.id})`.as('last_reviewed_at'),
      })
      .from(products)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(products.syncedAt))
      .limit(limit)

    return NextResponse.json({ 
      products: productList.map(p => ({
        ...p,
        reviewCount: Number(p.reviewCount) || 0
      }))
    })
  } catch (error) {
    console.error('Error fetching products:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch products' },
      { status: 500 }
    )
  }
}
