import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { products, shops } from '@/lib/schema'
import { eq, and, ilike, or, desc } from 'drizzle-orm'

// GET /api/products/search - Search products
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const shopId = searchParams.get('shop')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)

    const conditions = []

    // Shop filter
    if (shopId && shopId !== 'all') {
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

    let query = db
      .select({
        id: products.id,
        name: products.name,
        imageUrl: products.imageUrl,
        category: products.category,
        price: products.price,
        shopId: products.shopId,
      })
      .from(products)

    const productList = conditions.length > 0
      ? await query
          .where(and(...conditions))
          .orderBy(desc(products.syncedAt))
          .limit(limit)
      : await query
          .orderBy(desc(products.syncedAt))
          .limit(limit)

    return NextResponse.json({ products: productList })
  } catch (error) {
    console.error('Error searching products:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to search products' },
      { status: 500 }
    )
  }
}
