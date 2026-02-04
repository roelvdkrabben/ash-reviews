import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { reviews } from '@/lib/schema'
import { inArray } from 'drizzle-orm'

// Bulk approve/reject reviews
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { ids, action, reason } = body

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'No review IDs provided' }, { status: 400 })
    }

    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json({ error: 'Invalid action. Use "approve" or "reject"' }, { status: 400 })
    }

    const updateData = action === 'approve'
      ? {
          status: 'approved',
          approvedAt: new Date(),
          approvedBy: session.user.email || session.user.name || 'unknown',
          updatedAt: new Date(),
        }
      : {
          status: 'rejected',
          rejectedAt: new Date(),
          rejectionReason: reason || null,
          updatedAt: new Date(),
        }

    const updated = await db
      .update(reviews)
      .set(updateData)
      .where(inArray(reviews.id, ids))
      .returning()

    return NextResponse.json({ 
      success: true, 
      count: updated.length,
      action 
    })
  } catch (error) {
    console.error('Error bulk updating reviews:', error)
    return NextResponse.json(
      { error: 'Failed to bulk update reviews' },
      { status: 500 }
    )
  }
}
