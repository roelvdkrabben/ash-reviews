import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { reviews } from '@/lib/schema'
import { eq } from 'drizzle-orm'

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

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error approving review:', error)
    return NextResponse.json(
      { error: 'Failed to approve review' },
      { status: 500 }
    )
  }
}
