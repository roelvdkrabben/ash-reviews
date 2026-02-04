import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { productQueue, products, shops } from '@/lib/schema'
import { eq, and, desc, asc, ne } from 'drizzle-orm'

// GET /api/queue/products - List queued products
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const shopId = searchParams.get('shop')
    const status = searchParams.get('status')

    let query = db
      .select({
        queueItem: productQueue,
        product: products,
        shop: shops,
      })
      .from(productQueue)
      .leftJoin(products, eq(productQueue.productId, products.id))
      .leftJoin(shops, eq(productQueue.shopId, shops.id))

    const conditions = []
    if (shopId && shopId !== 'all') {
      conditions.push(eq(productQueue.shopId, shopId))
    }
    if (status && status !== 'all') {
      conditions.push(eq(productQueue.status, status))
    }

    const results = conditions.length > 0
      ? await query.where(and(...conditions)).orderBy(desc(productQueue.priority), asc(productQueue.addedAt)).limit(200)
      : await query.orderBy(desc(productQueue.priority), asc(productQueue.addedAt)).limit(200)

    // Calculate stats
    const allItems = await db.select({ status: productQueue.status }).from(productQueue)
    const stats = {
      pending: allItems.filter(i => i.status === 'pending').length,
      generating: allItems.filter(i => i.status === 'generating').length,
      completed: allItems.filter(i => i.status === 'completed').length,
      failed: allItems.filter(i => i.status === 'failed').length,
    }

    return NextResponse.json({ items: results, stats })
  } catch (error) {
    console.error('Error fetching product queue:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch queue' },
      { status: 500 }
    )
  }
}

// POST /api/queue/products - Add product(s) to queue
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { productIds } = body as { productIds: string[] }

    if (!productIds || productIds.length === 0) {
      return NextResponse.json(
        { error: 'productIds is required' },
        { status: 400 }
      )
    }

    // Get products with their shop IDs
    const productList = await db
      .select({ id: products.id, shopId: products.shopId })
      .from(products)
      .where(eq(products.id, productIds[0]))

    // For each product, check if already in pending/generating queue
    const inserted = []
    const skipped = []

    for (const prodId of productIds) {
      // Get product info
      const [product] = await db
        .select({ id: products.id, shopId: products.shopId, name: products.name })
        .from(products)
        .where(eq(products.id, prodId))
        .limit(1)

      if (!product || !product.shopId) {
        skipped.push({ id: prodId, reason: 'Product not found' })
        continue
      }

      // Check if already in active queue (pending or generating)
      const existing = await db
        .select({ id: productQueue.id })
        .from(productQueue)
        .where(
          and(
            eq(productQueue.productId, prodId),
            eq(productQueue.shopId, product.shopId),
            // Only block if pending or generating
            eq(productQueue.status, 'pending')
          )
        )
        .limit(1)

      // Also check generating status separately
      const existingGenerating = await db
        .select({ id: productQueue.id })
        .from(productQueue)
        .where(
          and(
            eq(productQueue.productId, prodId),
            eq(productQueue.shopId, product.shopId),
            eq(productQueue.status, 'generating')
          )
        )
        .limit(1)

      if (existing.length > 0 || existingGenerating.length > 0) {
        skipped.push({ id: prodId, name: product.name, reason: 'Already in queue' })
        continue
      }

      // Add to queue
      const [newItem] = await db
        .insert(productQueue)
        .values({
          shopId: product.shopId,
          productId: prodId,
          status: 'pending',
          priority: 0,
        })
        .returning()

      inserted.push({ id: newItem.id, productId: prodId, name: product.name })
    }

    return NextResponse.json({
      success: true,
      inserted: inserted.length,
      skipped: skipped.length,
      details: { inserted, skipped }
    })
  } catch (error) {
    console.error('Error adding to product queue:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add to queue' },
      { status: 500 }
    )
  }
}

// DELETE /api/queue/products - Bulk delete from queue
export async function DELETE(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { ids, clearCompleted } = body as { ids?: string[], clearCompleted?: boolean }

    if (clearCompleted) {
      // Clear all completed items
      await db.delete(productQueue).where(eq(productQueue.status, 'completed'))
      return NextResponse.json({ success: true, message: 'Cleared completed items' })
    }

    if (!ids || ids.length === 0) {
      return NextResponse.json(
        { error: 'ids is required' },
        { status: 400 }
      )
    }

    // Delete each item
    let deleted = 0
    for (const id of ids) {
      const result = await db.delete(productQueue).where(eq(productQueue.id, id))
      deleted++
    }

    return NextResponse.json({ success: true, deleted })
  } catch (error) {
    console.error('Error removing from queue:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to remove from queue' },
      { status: 500 }
    )
  }
}
