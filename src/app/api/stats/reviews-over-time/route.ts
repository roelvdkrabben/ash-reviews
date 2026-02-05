import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { reviews, shops } from '@/lib/schema'
import { sql, gte, lte, and, eq, isNotNull, gt, or } from 'drizzle-orm'

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

  // Calculate future end date for scheduled reviews (same number of days into future)
  const futureEndDate = new Date()
  futureEndDate.setDate(futureEndDate.getDate() + days)
  futureEndDate.setHours(23, 59, 59, 999)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  try {
    // Get all shops first
    const allShops = await db.select({
      id: shops.id,
      name: shops.name,
    }).from(shops)

    // 1. Get POSTED reviews grouped by posted_at date and shop
    const postedReviews = await db
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

    // 2. Get IMPORTED reviews grouped by postedAt (if exists) or createdAt
    const importedReviews = await db
      .select({
        date: sql<string>`DATE(COALESCE(${reviews.postedAt}, ${reviews.createdAt}))`.as('date'),
        shopId: reviews.shopId,
        count: sql<number>`COUNT(*)`.as('count'),
      })
      .from(reviews)
      .where(
        and(
          eq(reviews.status, 'imported'),
          or(
            gte(reviews.postedAt, startDate),
            and(
              sql`${reviews.postedAt} IS NULL`,
              gte(reviews.createdAt, startDate)
            )
          )
        )
      )
      .groupBy(sql`DATE(COALESCE(${reviews.postedAt}, ${reviews.createdAt}))`, reviews.shopId)
      .orderBy(sql`DATE(COALESCE(${reviews.postedAt}, ${reviews.createdAt}))`)

    // 3. Get SCHEDULED reviews (approved with scheduledAt in the future, limited to futureEndDate)
    const scheduledReviews = await db
      .select({
        date: sql<string>`DATE(${reviews.scheduledAt})`.as('date'),
        shopId: reviews.shopId,
        count: sql<number>`COUNT(*)`.as('count'),
      })
      .from(reviews)
      .where(
        and(
          eq(reviews.status, 'approved'),
          isNotNull(reviews.scheduledAt),
          gt(reviews.scheduledAt, today),
          lte(reviews.scheduledAt, futureEndDate)
        )
      )
      .groupBy(sql`DATE(${reviews.scheduledAt})`, reviews.shopId)
      .orderBy(sql`DATE(${reviews.scheduledAt})`)

    // Generate all dates in range (past + future for scheduled)
    const pastLabels: string[] = []
    const futureLabels: string[] = []
    
    // Past dates (including today)
    const currentDate = new Date(startDate)
    const endOfToday = new Date()
    endOfToday.setHours(23, 59, 59, 999)
    
    while (currentDate <= endOfToday) {
      pastLabels.push(currentDate.toISOString().split('T')[0])
      currentDate.setDate(currentDate.getDate() + 1)
    }

    // Future dates (after today)
    const tomorrowDate = new Date(today)
    tomorrowDate.setDate(tomorrowDate.getDate() + 1)
    const futureDateIter = new Date(tomorrowDate)
    
    while (futureDateIter <= futureEndDate) {
      futureLabels.push(futureDateIter.toISOString().split('T')[0])
      futureDateIter.setDate(futureDateIter.getDate() + 1)
    }

    const allLabels = [...pastLabels, ...futureLabels]

    // Create maps for quick lookup
    const postedMap = new Map<string, number>()
    postedReviews.forEach(row => {
      const key = `${row.date}_${row.shopId}`
      postedMap.set(key, Number(row.count))
    })

    const importedMap = new Map<string, number>()
    importedReviews.forEach(row => {
      const key = `${row.date}_${row.shopId}`
      importedMap.set(key, Number(row.count))
    })

    const scheduledMap = new Map<string, number>()
    scheduledReviews.forEach(row => {
      const key = `${row.date}_${row.shopId}`
      scheduledMap.set(key, Number(row.count))
    })

    // Build datasets for each shop with all three types
    const datasets = allShops.map(shop => {
      const postedData = allLabels.map(date => {
        const key = `${date}_${shop.id}`
        return postedMap.get(key) || 0
      })
      
      const importedData = allLabels.map(date => {
        const key = `${date}_${shop.id}`
        return importedMap.get(key) || 0
      })

      const scheduledData = allLabels.map(date => {
        const key = `${date}_${shop.id}`
        return scheduledMap.get(key) || 0
      })
      
      return {
        shopId: shop.id,
        shopName: shop.name,
        posted: postedData,
        imported: importedData,
        scheduled: scheduledData,
      }
    })

    // Find today's index for the chart to know where future starts
    const todayStr = today.toISOString().split('T')[0]
    const todayIndex = allLabels.indexOf(todayStr)

    return NextResponse.json({
      labels: allLabels,
      datasets,
      todayIndex,
    })
  } catch (error) {
    console.error('Error fetching reviews over time:', error)
    return NextResponse.json(
      { error: 'Failed to fetch data' },
      { status: 500 }
    )
  }
}
