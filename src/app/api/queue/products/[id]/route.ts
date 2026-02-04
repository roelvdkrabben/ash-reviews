import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { productQueue } from '@/lib/schema'
import { eq } from 'drizzle-orm'

interface RouteParams {
  params: Promise<{ id: string }>
}

// PUT /api/queue/products/[id] - Update priority or status
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = await request.json()
    const { priority, status } = body as { priority?: number, status?: string }

    const updates: Partial<{
      priority: number
      status: string
    }> = {}

    if (typeof priority === 'number') {
      updates.priority = priority
    }
    if (status && ['pending', 'generating', 'completed', 'failed'].includes(status)) {
      updates.status = status
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid updates provided' },
        { status: 400 }
      )
    }

    const [updated] = await db
      .update(productQueue)
      .set(updates)
      .where(eq(productQueue.id, id))
      .returning()

    if (!updated) {
      return NextResponse.json(
        { error: 'Queue item not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, item: updated })
  } catch (error) {
    console.error('Error updating queue item:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update queue item' },
      { status: 500 }
    )
  }
}

// DELETE /api/queue/products/[id] - Remove from queue
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params

    const [deleted] = await db
      .delete(productQueue)
      .where(eq(productQueue.id, id))
      .returning()

    if (!deleted) {
      return NextResponse.json(
        { error: 'Queue item not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing queue item:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to remove queue item' },
      { status: 500 }
    )
  }
}
