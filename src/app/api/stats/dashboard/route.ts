import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { reviews, shops, products } from '@/lib/schema'
import { sql, eq, and, gte, asc, isNotNull } from 'drizzle-orm'

export async function GET() {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Count shops
    const [shopCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(shops)

    // Count products
    const [productCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(products)

    // Count reviews by status
    const reviewCounts = await db
      .select({
        status: reviews.status,
        count: sql<number>`COUNT(*)`,
      })
      .from(reviews)
      .groupBy(reviews.status)

    // Convert to object
    const statusCounts: Record<string, number> = {}
    reviewCounts.forEach(row => {
      statusCounts[row.status] = Number(row.count)
    })

    // Total reviews (excluding imported)
    const totalGenerated = (statusCounts['pending'] || 0) + 
                          (statusCounts['approved'] || 0) + 
                          (statusCounts['posted'] || 0) +
                          (statusCounts['failed'] || 0)

    // Get next 5 scheduled reviews (approved with scheduledAt in future)
    const now = new Date()
    const upcomingReviews = await db
      .select({
        id: reviews.id,
        reviewerName: reviews.reviewerName,
        rating: reviews.rating,
        content: reviews.content,
        scheduledAt: reviews.scheduledAt,
        productId: reviews.productId,
        shopId: reviews.shopId,
        productName: products.name,
        shopName: shops.name,
      })
      .from(reviews)
      .leftJoin(products, eq(reviews.productId, products.id))
      .leftJoin(shops, eq(reviews.shopId, shops.id))
      .where(
        and(
          eq(reviews.status, 'approved'),
          isNotNull(reviews.scheduledAt),
          gte(reviews.scheduledAt, now)
        )
      )
      .orderBy(asc(reviews.scheduledAt))
      .limit(5)

    return NextResponse.json({
      shops: Number(shopCount?.count || 0),
      products: Number(productCount?.count || 0),
      pending: statusCounts['pending'] || 0,
      approved: statusCounts['approved'] || 0,
      posted: statusCounts['posted'] || 0,
      failed: statusCounts['failed'] || 0,
      imported: statusCounts['imported'] || 0,
      totalGenerated,
      upcomingReviews: upcomingReviews.map(r => ({
        id: r.id,
        reviewerName: r.reviewerName,
        rating: r.rating,
        content: r.content?.substring(0, 100) + (r.content && r.content.length > 100 ? '...' : ''),
        scheduledAt: r.scheduledAt,
        productName: r.productName,
        shopName: r.shopName,
      })),
    })
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    )
  }
}
