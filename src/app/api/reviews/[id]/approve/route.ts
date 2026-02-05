import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { reviews } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { scheduleReviewsForShop } from '@/lib/review-scheduler'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params

    const [updated] = await db
      .update(reviews)
      .set({
        status: 'approved',
        approvedAt: new Date(),
        approvedBy: session.user.email || session.user.name || 'unknown',
        updatedAt: new Date(),
      })
      .where(eq(reviews.id, id))
      .returning()

    if (!updated) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 })
    }

    // Schedule the review for posting based on shop settings
    if (updated.shopId) {
      try {
        await scheduleReviewsForShop(updated.shopId, [updated.id])
        console.log(`[Approve] Scheduled review ${updated.id} for shop ${updated.shopId}`)
      } catch (scheduleError) {
        console.error('[Approve] Failed to schedule review:', scheduleError)
        // Don't fail the approval, just log the scheduling error
      }
    }

    // Fetch the updated review with scheduled time
    const [finalReview] = await db
      .select()
      .from(reviews)
      .where(eq(reviews.id, id))
      .limit(1)

    return NextResponse.json(finalReview || updated)
  } catch (error) {
    console.error('Error approving review:', error)
    return NextResponse.json(
      { error: 'Failed to approve review' },
      { status: 500 }
    )
  }
}
