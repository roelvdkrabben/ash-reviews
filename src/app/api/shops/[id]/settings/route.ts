import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { shops } from '@/lib/schema'
import { eq } from 'drizzle-orm'

// GET /api/shops/[id]/settings - Get shop settings
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const [shop] = await db
      .select({
        id: shops.id,
        name: shops.name,
        reviewsPerWeek: shops.reviewsPerWeek,
        activeDays: shops.activeDays,
        timeSlotStart: shops.timeSlotStart,
        timeSlotEnd: shops.timeSlotEnd,
        minHoursBetween: shops.minHoursBetween,
        priorityBestsellers: shops.priorityBestsellers,
        priorityNoReviews: shops.priorityNoReviews,
        priorityStale: shops.priorityStale,
        staleDaysThreshold: shops.staleDaysThreshold,
        autoGenerate: shops.autoGenerate,
      })
      .from(shops)
      .where(eq(shops.id, id))
      .limit(1)

    if (!shop) {
      return NextResponse.json({ error: 'Shop niet gevonden' }, { status: 404 })
    }

    return NextResponse.json(shop)
  } catch (error) {
    console.error('Error fetching shop settings:', error)
    return NextResponse.json({ error: 'Fout bij ophalen instellingen' }, { status: 500 })
  }
}

// PUT /api/shops/[id]/settings - Update shop settings
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = await request.json()
    
    const {
      reviewsPerWeek,
      activeDays,
      timeSlotStart,
      timeSlotEnd,
      minHoursBetween,
      priorityBestsellers,
      priorityNoReviews,
      priorityStale,
      staleDaysThreshold,
      autoGenerate,
    } = body

    // Validate priority sum
    if (
      priorityBestsellers !== undefined &&
      priorityNoReviews !== undefined &&
      priorityStale !== undefined
    ) {
      const sum = priorityBestsellers + priorityNoReviews + priorityStale
      if (sum !== 100) {
        return NextResponse.json(
          { error: `Prioriteiten moeten optellen tot 100% (nu: ${sum}%)` },
          { status: 400 }
        )
      }
    }

    // Validate reviews per week
    if (reviewsPerWeek !== undefined && (reviewsPerWeek < 2 || reviewsPerWeek > 20)) {
      return NextResponse.json(
        { error: 'Reviews per week moet tussen 2 en 20 zijn' },
        { status: 400 }
      )
    }

    // Validate min hours between
    if (minHoursBetween !== undefined && (minHoursBetween < 1 || minHoursBetween > 24)) {
      return NextResponse.json(
        { error: 'Minimale uren tussen reviews moet tussen 1 en 24 zijn' },
        { status: 400 }
      )
    }

    const [updated] = await db
      .update(shops)
      .set({
        ...(reviewsPerWeek !== undefined && { reviewsPerWeek }),
        ...(activeDays !== undefined && { activeDays }),
        ...(timeSlotStart !== undefined && { timeSlotStart }),
        ...(timeSlotEnd !== undefined && { timeSlotEnd }),
        ...(minHoursBetween !== undefined && { minHoursBetween }),
        ...(priorityBestsellers !== undefined && { priorityBestsellers }),
        ...(priorityNoReviews !== undefined && { priorityNoReviews }),
        ...(priorityStale !== undefined && { priorityStale }),
        ...(staleDaysThreshold !== undefined && { staleDaysThreshold }),
        ...(autoGenerate !== undefined && { autoGenerate }),
        updatedAt: new Date(),
      })
      .where(eq(shops.id, id))
      .returning()

    if (!updated) {
      return NextResponse.json({ error: 'Shop niet gevonden' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      settings: {
        reviewsPerWeek: updated.reviewsPerWeek,
        activeDays: updated.activeDays,
        timeSlotStart: updated.timeSlotStart,
        timeSlotEnd: updated.timeSlotEnd,
        minHoursBetween: updated.minHoursBetween,
        priorityBestsellers: updated.priorityBestsellers,
        priorityNoReviews: updated.priorityNoReviews,
        priorityStale: updated.priorityStale,
        staleDaysThreshold: updated.staleDaysThreshold,
        autoGenerate: updated.autoGenerate,
      },
    })
  } catch (error) {
    console.error('Error updating shop settings:', error)
    return NextResponse.json({ error: 'Fout bij bijwerken instellingen' }, { status: 500 })
  }
}
