import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { reviews, shops } from '@/lib/schema'
import { eq, and, isNotNull, gte, inArray, sql } from 'drizzle-orm'

// GET scheduling overview for all shops
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '21') // 3 weeks default

    const now = new Date()
    now.setHours(0, 0, 0, 0) // Start of today
    
    // Get all scheduled reviews for the next N days
    const scheduledReviews = await db
      .select({
        id: reviews.id,
        shopId: reviews.shopId,
        status: reviews.status,
        scheduledAt: reviews.scheduledAt,
      })
      .from(reviews)
      .where(and(
        isNotNull(reviews.scheduledAt),
        gte(reviews.scheduledAt, now),
        inArray(reviews.status, ['pending', 'approved'])
      ))

    // Get all shops
    const allShops = await db.select({
      id: shops.id,
      name: shops.name,
      reviewsPerWeek: shops.reviewsPerWeek,
    }).from(shops)

    // Generate dates for the period
    const dates: string[] = []
    for (let i = 0; i < days; i++) {
      const date = new Date(now)
      date.setDate(date.getDate() + i)
      dates.push(date.toISOString().split('T')[0])
    }

    // Count reviews per day
    const dailyCounts: Record<string, { pending: number; approved: number; total: number }> = {}
    dates.forEach(date => {
      dailyCounts[date] = { pending: 0, approved: 0, total: 0 }
    })

    scheduledReviews.forEach(review => {
      if (review.scheduledAt) {
        const date = review.scheduledAt.toISOString().split('T')[0]
        if (dailyCounts[date]) {
          dailyCounts[date].total++
          if (review.status === 'pending') {
            dailyCounts[date].pending++
          } else {
            dailyCounts[date].approved++
          }
        }
      }
    })

    // Per-shop stats
    const shopStats = allShops.map(shop => {
      const shopReviews = scheduledReviews.filter(r => r.shopId === shop.id)
      
      // Find the latest scheduled date for this shop
      let latestDate: string | null = null
      let daysOfCoverage = 0
      
      shopReviews.forEach(r => {
        if (r.scheduledAt) {
          const date = r.scheduledAt.toISOString().split('T')[0]
          if (!latestDate || date > latestDate) {
            latestDate = date
          }
        }
      })

      if (latestDate) {
        const latestDateTime = new Date(latestDate).getTime()
        daysOfCoverage = Math.ceil((latestDateTime - now.getTime()) / (1000 * 60 * 60 * 24)) + 1
      }

      // Per-day breakdown for mini calendar
      const dailyBreakdown: Record<string, number> = {}
      dates.slice(0, 14).forEach(date => { // Only first 2 weeks for mini view
        dailyBreakdown[date] = 0
      })
      shopReviews.forEach(r => {
        if (r.scheduledAt) {
          const date = r.scheduledAt.toISOString().split('T')[0]
          if (dailyBreakdown[date] !== undefined) {
            dailyBreakdown[date]++
          }
        }
      })

      return {
        shopId: shop.id,
        shopName: shop.name,
        targetPerWeek: shop.reviewsPerWeek || 10,
        totalScheduled: shopReviews.length,
        pending: shopReviews.filter(r => r.status === 'pending').length,
        approved: shopReviews.filter(r => r.status === 'approved').length,
        latestScheduledDate: latestDate,
        daysOfCoverage,
        dailyBreakdown,
      }
    })

    // Calculate overall coverage
    const allDates = scheduledReviews
      .filter(r => r.scheduledAt)
      .map(r => r.scheduledAt!.toISOString().split('T')[0])
    
    const uniqueDates = [...new Set(allDates)].sort()
    const latestOverallDate = uniqueDates.length > 0 ? uniqueDates[uniqueDates.length - 1] : null
    
    let overallCoverageDays = 0
    if (latestOverallDate) {
      overallCoverageDays = Math.ceil(
        (new Date(latestOverallDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1
    }

    return NextResponse.json({
      overview: {
        totalScheduled: scheduledReviews.length,
        totalPending: scheduledReviews.filter(r => r.status === 'pending').length,
        totalApproved: scheduledReviews.filter(r => r.status === 'approved').length,
        latestScheduledDate: latestOverallDate,
        daysOfCoverage: overallCoverageDays,
        weeksOfCoverage: Math.floor(overallCoverageDays / 7),
      },
      dailyCounts,
      dates,
      shopStats,
    })
  } catch (error) {
    console.error('Error fetching scheduling overview:', error)
    return NextResponse.json(
      { error: 'Failed to fetch scheduling overview' },
      { status: 500 }
    )
  }
}
