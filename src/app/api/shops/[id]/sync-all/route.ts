/**
 * Combined Sync Endpoint
 * 
 * Syncs products, imports reviews, and links reviews to products
 * Updates the sync timestamps on the shop
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { shops, products, reviews } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { syncProducts } from '@/lib/sync'
import { importReviewsFromLightspeed } from '@/lib/import-reviews'
import { createLightspeedClient, LightspeedReview } from '@/lib/lightspeed'

interface RouteParams {
  params: Promise<{ id: string }>
}

interface SyncAllResult {
  success: boolean
  productsSync: {
    created: number
    updated: number
    total: number
  }
  reviewsImport: {
    imported: number
    skipped: number
    failed: number
  }
  reviewsLinked: number
  error?: string
  duration: number
}

/**
 * Fetch all reviews from Lightspeed with pagination
 */
async function fetchAllLightspeedReviews(
  apiKey: string, 
  apiSecret: string
): Promise<LightspeedReview[]> {
  const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')
  const allReviews: LightspeedReview[] = []
  let page = 1
  
  while (true) {
    const res = await fetch(`https://api.webshopapp.com/nl/reviews.json?limit=250&page=${page}`, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    })
    
    if (!res.ok) {
      if (res.status === 429) {
        // Rate limited, wait and retry
        await new Promise(r => setTimeout(r, 60000))
        continue
      }
      throw new Error(`API error ${res.status}`)
    }
    
    const data = await res.json()
    const fetchedReviews = data.reviews || []
    
    if (fetchedReviews.length === 0) break
    
    allReviews.push(...fetchedReviews)
    
    if (fetchedReviews.length < 250) break
    page++
    
    // Small delay between pages
    await new Promise(r => setTimeout(r, 500))
  }
  
  return allReviews
}

/**
 * Link reviews to products using Lightspeed data
 */
async function linkReviewsToProducts(
  shopId: string,
  apiKey: string,
  apiSecret: string
): Promise<number> {
  // Fetch all reviews from Lightspeed
  const lsReviews = await fetchAllLightspeedReviews(apiKey, apiSecret)
  
  // Build map: external_review_id -> external_product_id
  const reviewProductMap = new Map<string, string>()
  for (const r of lsReviews) {
    if (r.product?.resource?.id) {
      reviewProductMap.set(String(r.id), String(r.product.resource.id))
    }
  }
  
  // Build product lookup: external_product_id -> our_product_id
  const shopProducts = await db
    .select({ id: products.id, externalId: products.externalId })
    .from(products)
    .where(eq(products.shopId, shopId))
  
  const productMap = new Map(shopProducts.map(p => [p.externalId, p.id]))
  
  // Get unlinked reviews from our DB
  const unlinkedReviews = await db
    .select({ id: reviews.id, externalId: reviews.externalId })
    .from(reviews)
    .where(eq(reviews.shopId, shopId))
  
  // Filter to only those without product_id and with external_id
  const toLink = unlinkedReviews.filter(r => r.externalId !== null)
  
  let linked = 0
  
  for (const review of toLink) {
    if (!review.externalId) continue
    
    // Check if this review already has a product linked
    const [existingReview] = await db
      .select({ productId: reviews.productId })
      .from(reviews)
      .where(eq(reviews.id, review.id))
    
    if (existingReview?.productId) continue
    
    const externalProductId = reviewProductMap.get(review.externalId)
    if (!externalProductId) continue
    
    const productId = productMap.get(externalProductId)
    if (!productId) continue
    
    await db
      .update(reviews)
      .set({ productId })
      .where(eq(reviews.id, review.id))
    
    linked++
  }
  
  return linked
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id: shopId } = await params
  const startTime = Date.now()
  
  try {
    // Get shop with API credentials
    const [shop] = await db
      .select()
      .from(shops)
      .where(eq(shops.id, shopId))
      .limit(1)
    
    if (!shop) {
      return NextResponse.json(
        { error: 'Shop niet gevonden' },
        { status: 404 }
      )
    }
    
    if (!shop.lightspeedApiKey || !shop.lightspeedApiSecret) {
      return NextResponse.json(
        { error: 'Lightspeed API credentials niet geconfigureerd' },
        { status: 400 }
      )
    }
    
    // 1. Sync products
    const productResult = await syncProducts(shopId)
    
    if (!productResult.success) {
      return NextResponse.json(
        { 
          error: `Product sync mislukt: ${productResult.error}`,
          productsSync: { created: 0, updated: 0, total: 0 },
          reviewsImport: { imported: 0, skipped: 0, failed: 0 },
          reviewsLinked: 0,
          duration: Date.now() - startTime,
        },
        { status: 500 }
      )
    }
    
    // Update last_products_sync timestamp
    await db
      .update(shops)
      .set({ lastProductsSync: new Date() })
      .where(eq(shops.id, shopId))
    
    // 2. Import reviews
    const reviewResult = await importReviewsFromLightspeed(shopId)
    
    if (!reviewResult.success) {
      // Products synced but reviews failed - partial success
      return NextResponse.json({
        success: false,
        error: `Review import mislukt: ${reviewResult.error}`,
        productsSync: {
          created: productResult.productsCreated,
          updated: productResult.productsUpdated,
          total: productResult.totalProducts,
        },
        reviewsImport: { imported: 0, skipped: 0, failed: 0 },
        reviewsLinked: 0,
        duration: Date.now() - startTime,
      })
    }
    
    // Update last_reviews_sync timestamp
    await db
      .update(shops)
      .set({ lastReviewsSync: new Date() })
      .where(eq(shops.id, shopId))
    
    // 3. Link reviews to products
    const linkedCount = await linkReviewsToProducts(
      shopId,
      shop.lightspeedApiKey,
      shop.lightspeedApiSecret
    )
    
    const result: SyncAllResult = {
      success: true,
      productsSync: {
        created: productResult.productsCreated,
        updated: productResult.productsUpdated,
        total: productResult.totalProducts,
      },
      reviewsImport: {
        imported: reviewResult.imported,
        skipped: reviewResult.skipped,
        failed: reviewResult.failed,
      },
      reviewsLinked: linkedCount,
      duration: Date.now() - startTime,
    }
    
    return NextResponse.json(result)
    
  } catch (error) {
    console.error('Sync-all error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Onbekende fout',
        productsSync: { created: 0, updated: 0, total: 0 },
        reviewsImport: { imported: 0, skipped: 0, failed: 0 },
        reviewsLinked: 0,
        duration: Date.now() - startTime,
      },
      { status: 500 }
    )
  }
}
