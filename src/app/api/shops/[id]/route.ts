import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { shops } from '@/lib/schema'
import { eq } from 'drizzle-orm'

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
      .select()
      .from(shops)
      .where(eq(shops.id, id))
      .limit(1)

    if (!shop) {
      return NextResponse.json({ error: 'Shop niet gevonden' }, { status: 404 })
    }

    return NextResponse.json(shop)
  } catch (error) {
    console.error('Error fetching shop:', error)
    return NextResponse.json({ error: 'Fout bij ophalen' }, { status: 500 })
  }
}

export async function PATCH(
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
    const { name, domain, lightspeedApiKey, lightspeedApiSecret } = body

    const [updated] = await db
      .update(shops)
      .set({
        ...(name && { name }),
        ...(domain && { domain }),
        ...(lightspeedApiKey !== undefined && { lightspeedApiKey }),
        ...(lightspeedApiSecret !== undefined && { lightspeedApiSecret }),
        updatedAt: new Date(),
      })
      .where(eq(shops.id, id))
      .returning()

    if (!updated) {
      return NextResponse.json({ error: 'Shop niet gevonden' }, { status: 404 })
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating shop:', error)
    return NextResponse.json({ error: 'Fout bij bijwerken' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const [deleted] = await db
      .delete(shops)
      .where(eq(shops.id, id))
      .returning()

    if (!deleted) {
      return NextResponse.json({ error: 'Shop niet gevonden' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting shop:', error)
    return NextResponse.json({ error: 'Fout bij verwijderen' }, { status: 500 })
  }
}
