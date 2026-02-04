import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { products } from '@/lib/schema'
import { eq, desc } from 'drizzle-orm'

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
    
    const productList = await db
      .select()
      .from(products)
      .where(eq(products.shopId, id))
      .orderBy(desc(products.syncedAt))

    return NextResponse.json(productList)
  } catch (error) {
    console.error('Error fetching products:', error)
    return NextResponse.json({ error: 'Fout bij ophalen' }, { status: 500 })
  }
}
