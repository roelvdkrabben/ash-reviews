import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { reviews, shops } from '@/lib/schema'
import { sql, gte, lte, and, eq, or } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const days = parseInt(searchParams.get('days') || '30', 10)

  // Calculate start date (past)
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  startDate.setHours(0, 0, 0, 0)

  const today = new Date()
  today.setHours(23, 59, 59, 999)

  try {
    // Get all shops first
    const allShops = await db.select({
      id: shops.id,
      name: shops.name,
    }).from(shops)

    // Get posted + imported reviews (everything that's been placed)
    const pastReviews = await db
      .select({
        date: sql<string>`DATE(COALESCE(${reviews.postedAt}, ${reviews.createdAt}))`.as('date'),
        shopId: reviews.shopId,
        count: sql<number>`COUNT(*)`.as('count'),
      })
      .from(reviews)
      .where(
        and(
          or(
            eq(reviews.status, 'posted'),
            eq(reviews.status, 'imported')
          ),
          or(
            gte(reviews.postedAt, startDate),
            and(
              sql`${reviews.postedAt} IS NULL`,
              gte(reviews.createdAt, startDate)
            )
          ),
          lte(sql`COALESCE(${reviews.postedAt}, ${reviews.createdAt})`, today)
        )
      )
      .groupBy(sql`DATE(COALESCE(${reviews.postedAt}, ${reviews.createdAt}))`, reviews.shopId)
      .orderBy(sql`DATE(COALESCE(${reviews.postedAt}, ${reviews.createdAt}))`)

    // Generate date labels for the selected period
    const labels: string[] = []
    const currentDate = new Date(startDate)
    
    while (currentDate <= today) {
      labels.push(currentDate.toISOString().split('T')[0])
      currentDate.setDate(currentDate.getDate() + 1)
    }

    // Create map for quick lookup
    const pastMap = new Map<string, number>()
    pastReviews.forEach(row => {
      const key = `${row.date}_${row.shopId}`
      pastMap.set(key, Number(row.count))
    })

    // Build datasets for each shop
    const datasets = allShops.map(shop => {
      const pastData = labels.map(date => {
        const key = `${date}_${shop.id}`
        return pastMap.get(key) || 0
      })
      
      return {
        shopId: shop.id,
        shopName: shop.name,
        past: pastData,
      }
    })

    return NextResponse.json({
      labels,
      datasets,
    })
  } catch (error) {
    console.error('Error fetching reviews over time:', error)
    return NextResponse.json(
      { error: 'Failed to fetch data' },
      { status: 500 }
    )
  }
}
