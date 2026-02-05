import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { reviews, products } from '@/lib/schema'
import { eq, and, isNotNull, gte, asc, inArray } from 'drizzle-orm'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET scheduled reviews for a shop
export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id: shopId } = await params
    const { searchParams } = new URL(request.url)
    const statusFilter = searchParams.get('status') // 'pending', 'approved', or null for all
    const days = parseInt(searchParams.get('days') || '30') // Look ahead days

    const now = new Date()
    const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)

    // Build query conditions
    const conditions = [
      eq(reviews.shopId, shopId),
      isNotNull(reviews.scheduledAt),
      gte(reviews.scheduledAt, now),
    ]

    // Add status filter if provided
    if (statusFilter && ['pending', 'approved'].includes(statusFilter)) {
      conditions.push(eq(reviews.status, statusFilter))
    } else {
      // Only show pending and approved for scheduled view
      conditions.push(inArray(reviews.status, ['pending', 'approved']))
    }

    const scheduledReviews = await db
      .select({
        review: reviews,
        product: products,
      })
      .from(reviews)
      .leftJoin(products, eq(reviews.productId, products.id))
      .where(and(...conditions))
      .orderBy(asc(reviews.scheduledAt))
      .limit(100)

    // Group by date for timeline view
    const grouped = scheduledReviews.reduce((acc, item) => {
      const date = item.review.scheduledAt!.toISOString().split('T')[0]
      if (!acc[date]) {
        acc[date] = []
      }
      acc[date].push(item)
      return acc
    }, {} as Record<string, typeof scheduledReviews>)

    // Stats
    const stats = {
      total: scheduledReviews.length,
      pending: scheduledReviews.filter(r => r.review.status === 'pending').length,
      approved: scheduledReviews.filter(r => r.review.status === 'approved').length,
      thisWeek: scheduledReviews.filter(r => {
        const diff = r.review.scheduledAt!.getTime() - now.getTime()
        return diff <= 7 * 24 * 60 * 60 * 1000
      }).length,
    }

    return NextResponse.json({
      reviews: scheduledReviews,
      grouped,
      stats,
    })
  } catch (error) {
    console.error('Error fetching scheduled reviews:', error)
    return NextResponse.json(
      { error: 'Failed to fetch scheduled reviews' },
      { status: 500 }
    )
  }
}
