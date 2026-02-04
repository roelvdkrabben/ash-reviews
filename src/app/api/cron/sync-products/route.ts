import { NextResponse } from 'next/server'
import { syncProducts } from '@/lib/sync'
import { importReviewsFromLightspeed } from '@/lib/import-reviews'
import { db } from '@/lib/db'
import { shops } from '@/lib/schema'

interface ShopSyncResult {
  shopId: string
  shopName: string
  productSync: {
    success: boolean
    created: number
    updated: number
    error?: string
  }
  reviewImport: {
    success: boolean
    imported: number
    skipped: number
    failed: number
    error?: string
  }
}

/**
 * Cron job endpoint for auto-syncing products AND reviews from all shops
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
    console.log('[CRON] Starting product sync and review import for all shops...')
    
    // Get all shops with credentials
    const allShops = await db
      .select()
      .from(shops)
    
    const shopsWithCredentials = allShops.filter(
      shop => shop.lightspeedApiKey && shop.lightspeedApiSecret
    )

    const results: ShopSyncResult[] = []

    for (const shop of shopsWithCredentials) {
      // 1. Sync products
      const productResult = await syncProducts(shop.id)
      
      // 2. Import reviews
      const reviewResult = await importReviewsFromLightspeed(shop.id)
      
      // 3. Log result
      console.log(`[CRON] Shop ${shop.name}: ${productResult.productsCreated + productResult.productsUpdated} products synced, ${reviewResult.imported} reviews imported`)
      
      results.push({
        shopId: shop.id,
        shopName: shop.name,
        productSync: {
          success: productResult.success,
          created: productResult.productsCreated,
          updated: productResult.productsUpdated,
          error: productResult.error,
        },
        reviewImport: {
          success: reviewResult.success,
          imported: reviewResult.imported,
          skipped: reviewResult.skipped,
          failed: reviewResult.failed,
          error: reviewResult.error,
        },
      })
    }
    
    const summary = {
      totalShops: results.length,
      productSyncSuccessful: results.filter(r => r.productSync.success).length,
      reviewImportSuccessful: results.filter(r => r.reviewImport.success).length,
      totalProductsCreated: results.reduce((sum, r) => sum + r.productSync.created, 0),
      totalProductsUpdated: results.reduce((sum, r) => sum + r.productSync.updated, 0),
      totalReviewsImported: results.reduce((sum, r) => sum + r.reviewImport.imported, 0),
      totalReviewsSkipped: results.reduce((sum, r) => sum + r.reviewImport.skipped, 0),
      results,
    }

    console.log('[CRON] Sync complete:', {
      shops: summary.totalShops,
      productSyncSuccessful: summary.productSyncSuccessful,
      reviewImportSuccessful: summary.reviewImportSuccessful,
      productsCreated: summary.totalProductsCreated,
      productsUpdated: summary.totalProductsUpdated,
      reviewsImported: summary.totalReviewsImported,
      reviewsSkipped: summary.totalReviewsSkipped,
    })

    return NextResponse.json({
      success: true,
      message: `Sync voltooid: ${summary.totalProductsCreated + summary.totalProductsUpdated} products, ${summary.totalReviewsImported} reviews imported`,
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
