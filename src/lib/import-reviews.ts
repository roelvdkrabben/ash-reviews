/**
 * Review Import Service
 * 
 * Imports existing reviews from Lightspeed eCom to our database
 */

import { db } from './db'
import { shops, products, reviews } from './schema'
import { eq, and } from 'drizzle-orm'
import { createLightspeedClient, LightspeedError, LightspeedReview } from './lightspeed'

export interface ImportResult {
  success: boolean
  shopId: string
  imported: number
  skipped: number  // already existing
  failed: number
  error?: string
  duration?: number
}

/**
 * Import all reviews from Lightspeed for a shop
 */
export async function importReviewsFromLightspeed(shopId: string): Promise<ImportResult> {
  const startTime = Date.now()
  
  try {
    // Get shop with API credentials
    const [shop] = await db
      .select()
      .from(shops)
      .where(eq(shops.id, shopId))
      .limit(1)

    if (!shop) {
      return {
        success: false,
        shopId,
        imported: 0,
        skipped: 0,
        failed: 0,
        error: 'Shop niet gevonden',
      }
    }

    if (!shop.lightspeedApiKey || !shop.lightspeedApiSecret) {
      return {
        success: false,
        shopId,
        imported: 0,
        skipped: 0,
        failed: 0,
        error: 'Lightspeed API credentials niet geconfigureerd',
      }
    }

    // Create Lightspeed client
    const client = createLightspeedClient(
      shop.lightspeedApiKey,
      shop.lightspeedApiSecret,
      'nl'
    )

    // Fetch all reviews from Lightspeed
    const lsReviews = await client.getReviews()

    // Get existing reviews with externalId for this shop to prevent duplicates
    const existingReviews = await db
      .select({ externalId: reviews.externalId })
      .from(reviews)
      .where(eq(reviews.shopId, shopId))

    const existingExternalIds = new Set(
      existingReviews
        .filter(r => r.externalId !== null)
        .map(r => r.externalId)
    )

    // Get all products for this shop to link reviews
    const shopProducts = await db
      .select({ id: products.id, externalId: products.externalId })
      .from(products)
      .where(eq(products.shopId, shopId))

    const productMap = new Map(
      shopProducts.map(p => [p.externalId, p.id])
    )

    let imported = 0
    let skipped = 0
    let failed = 0

    // Process each review
    for (const lsReview of lsReviews) {
      const externalId = String(lsReview.id)
      
      // Skip if already imported
      if (existingExternalIds.has(externalId)) {
        skipped++
        continue
      }

      // Get product ID from Lightspeed review
      const productExternalId = lsReview.product?.resource?.id
      const productId = productExternalId 
        ? productMap.get(String(productExternalId)) 
        : null

      try {
        // Insert the review
        await db.insert(reviews).values({
          shopId,
          productId: productId || null,
          status: 'imported',
          reviewerName: lsReview.name || 'Onbekend',
          rating: lsReview.score || 5,
          title: null, // Lightspeed reviews don't have titles
          content: lsReview.content || '',
          externalId,
          createdAt: new Date(lsReview.createdAt),
        })
        imported++
      } catch (error) {
        console.error(`Failed to import review ${externalId}:`, error)
        failed++
      }
    }

    return {
      success: true,
      shopId,
      imported,
      skipped,
      failed,
      duration: Date.now() - startTime,
    }
  } catch (error) {
    console.error('Import error:', error)
    
    let errorMessage = 'Onbekende fout'
    if (error instanceof LightspeedError) {
      errorMessage = `Lightspeed API fout (${error.statusCode}): ${error.message}`
    } else if (error instanceof Error) {
      errorMessage = error.message
    }

    return {
      success: false,
      shopId,
      imported: 0,
      skipped: 0,
      failed: 0,
      error: errorMessage,
      duration: Date.now() - startTime,
    }
  }
}

/**
 * Get imported reviews for a product (used as inspiration for AI generation)
 */
export async function getImportedReviewsForProduct(productId: string): Promise<string[]> {
  const importedReviews = await db
    .select({ content: reviews.content })
    .from(reviews)
    .where(
      and(
        eq(reviews.productId, productId),
        eq(reviews.status, 'imported')
      )
    )
    .limit(10)

  return importedReviews.map(r => r.content)
}
