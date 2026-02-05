import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { reviews, shops } from '@/lib/schema'
import { sql, gte, and, eq, isNotNull } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const days = parseInt(searchParams.get('days') || '30', 10)

  // Calculate start date
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  startDate.setHours(0, 0, 0, 0)

  try {
    // Get all shops first
    const allShops = await db.select({
      id: shops.id,
      name: shops.name,
    }).from(shops)

    // Get POSTED reviews grouped by posted_at date and shop
    // Only show reviews that have actually been posted to the website
    const reviewsData = await db
      .select({
        date: sql<string>`DATE(${reviews.postedAt})`.as('date'),
        shopId: reviews.shopId,
        count: sql<number>`COUNT(*)`.as('count'),
      })
      .from(reviews)
      .where(
        and(
          eq(reviews.status, 'posted'),
          isNotNull(reviews.postedAt),
          gte(reviews.postedAt, startDate)
        )
      )
      .groupBy(sql`DATE(${reviews.postedAt})`, reviews.shopId)
      .orderBy(sql`DATE(${reviews.postedAt})`)

    // Generate all dates in range
    const labels: string[] = []
    const currentDate = new Date(startDate)
    const endDate = new Date()
    
    while (currentDate <= endDate) {
      labels.push(currentDate.toISOString().split('T')[0])
      currentDate.setDate(currentDate.getDate() + 1)
    }

    // Create a map for quick lookup
    const dataMap = new Map<string, number>()
    reviewsData.forEach(row => {
      const key = `${row.date}_${row.shopId}`
      dataMap.set(key, Number(row.count))
    })

    // Build datasets for each shop
    const datasets = allShops.map(shop => {
      const data = labels.map(date => {
        const key = `${date}_${shop.id}`
        return dataMap.get(key) || 0
      })
      
      return {
        shopId: shop.id,
        shopName: shop.name,
        data,
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
