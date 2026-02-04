import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { importReviewsFromLightspeed } from '@/lib/import-reviews'

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
    const result = await importReviewsFromLightspeed(id)

    if (!result.success) {
      return NextResponse.json(
        { 
          error: result.error,
          details: result 
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Import voltooid: ${result.imported} geïmporteerd, ${result.skipped} overgeslagen`,
      imported: result.imported,
      skipped: result.skipped,
      failed: result.failed,
      duration: result.duration,
    })
  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json(
      { error: 'Fout bij importeren reviews' },
      { status: 500 }
    )
  }
}
