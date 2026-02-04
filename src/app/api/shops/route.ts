import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { shops } from '@/lib/schema'

export async function POST(request: Request) {
  const session = await auth()
  
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { name, slug, domain, lightspeedApiKey, lightspeedApiSecret } = body

    if (!name || !slug || !domain) {
      return NextResponse.json({ error: 'Naam, slug en domein zijn verplicht' }, { status: 400 })
    }

    const [newShop] = await db.insert(shops).values({
      name,
      slug,
      domain,
      lightspeedApiKey: lightspeedApiKey || null,
      lightspeedApiSecret: lightspeedApiSecret || null,
    }).returning()

    return NextResponse.json(newShop)
  } catch (error) {
    console.error('Error creating shop:', error)
    
    // Check for unique constraint violation
    if (error instanceof Error && error.message.includes('unique')) {
      return NextResponse.json({ error: 'Deze slug bestaat al' }, { status: 400 })
    }
    
    return NextResponse.json({ error: 'Fout bij opslaan' }, { status: 500 })
  }
}

export async function GET() {
  const session = await auth()
  
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const allShops = await db.select().from(shops)
    return NextResponse.json(allShops)
  } catch (error) {
    console.error('Error fetching shops:', error)
    return NextResponse.json({ error: 'Fout bij ophalen' }, { status: 500 })
  }
}
