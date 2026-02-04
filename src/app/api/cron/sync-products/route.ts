import { NextResponse } from 'next/server'
import { syncAllShops } from '@/lib/sync'

/**
 * Cron job endpoint for auto-syncing products from all shops
 * 
 * Vercel Cron: Runs daily at 3:00 AM UTC
 * Protected by CRON_SECRET header
 */
export async function GET(request: Request) {
  // Verify cron secret (Vercel sends this header for cron jobs)
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  
  // Allow if no CRON_SECRET is set (local dev) or if it matches
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    console.log('[CRON] Starting product sync for all shops...')
    
    const results = await syncAllShops()
    
    const summary = {
      totalShops: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      totalProductsCreated: results.reduce((sum, r) => sum + r.productsCreated, 0),
      totalProductsUpdated: results.reduce((sum, r) => sum + r.productsUpdated, 0),
      results,
    }

    console.log('[CRON] Sync complete:', {
      shops: summary.totalShops,
      successful: summary.successful,
      failed: summary.failed,
      productsCreated: summary.totalProductsCreated,
      productsUpdated: summary.totalProductsUpdated,
    })

    return NextResponse.json({
      success: true,
      message: `Sync voltooid voor ${summary.successful}/${summary.totalShops} shops`,
      ...summary,
    })
  } catch (error) {
    console.error('[CRON] Sync failed:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Onbekende fout',
      },
      { status: 500 }
    )
  }
}

// Support POST for manual triggers
export async function POST(request: Request) {
  return GET(request)
}
