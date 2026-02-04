import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { syncProducts } from '@/lib/sync'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const result = await syncProducts(id)

    if (!result.success) {
      return NextResponse.json(
        { 
          error: result.error,
          details: result 
        },
        { status: 400 }
      )
    }

    const { success: _success, ...resultData } = result
    return NextResponse.json({
      success: true,
      message: `Sync voltooid: ${result.productsCreated} nieuw, ${result.productsUpdated} bijgewerkt`,
      ...resultData,
    })
  } catch (error) {
    console.error('Sync error:', error)
    return NextResponse.json(
      { error: 'Fout bij synchroniseren' },
      { status: 500 }
    )
  }
}
