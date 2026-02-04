/**
 * Product Selection Service
 * 
 * Selects products for review generation based on shop slider settings:
 * - Priority for bestsellers (products with many reviews)
 * - Priority for products with no reviews  
 * - Priority for stale products (no recent reviews)
 */

import { db } from './db'
import { products, shops, reviews } from './schema'
import { eq, sql, and, desc, isNotNull } from 'drizzle-orm'

export interface ProductSelection {
  productId: string
  productName: string
  reason: 'bestseller' | 'no_reviews' | 'stale'
  score: number
}

interface ScoredProduct {
  id: string
  name: string
  reason: 'bestseller' | 'no_reviews' | 'stale'
  score: number
}

/**
 * Get shop settings with defaults
 */
async function getShopSettings(shopId: string) {
  const [shop] = await db
    .select({
      priorityBestsellers: shops.priorityBestsellers,
      priorityNoReviews: shops.priorityNoReviews,
      priorityStale: shops.priorityStale,
      staleDaysThreshold: shops.staleDaysThreshold,
    })
    .from(shops)
    .where(eq(shops.id, shopId))
    .limit(1)

  if (!shop) {
    throw new Error(`Shop not found: ${shopId}`)
  }

  return {
    priorityBestsellers: shop.priorityBestsellers ?? 60,
    priorityNoReviews: shop.priorityNoReviews ?? 25,
    priorityStale: shop.priorityStale ?? 15,
    staleDaysThreshold: shop.staleDaysThreshold ?? 30,
  }
}

/**
 * Get products with their review stats
 */
async function getProductsWithStats(shopId: string) {
  // Get all products for shop
  const allProducts = await db
    .select({
      id: products.id,
      name: products.name,
      reviewCount: products.reviewCount,
    })
    .from(products)
    .where(eq(products.shopId, shopId))

  // Get last review date for each product (only posted/imported reviews count)
  const lastReviewDates = await db
    .select({
      productId: reviews.productId,
      lastReviewAt: sql<string>`MAX(COALESCE(${reviews.postedAt}, ${reviews.createdAt}))`.as('last_review_at'),
    })
    .from(reviews)
    .where(
      and(
        eq(reviews.shopId, shopId),
        sql`${reviews.status} IN ('posted', 'imported')`
      )
    )
    .groupBy(reviews.productId)

  // Create a map of productId -> lastReviewAt
  const lastReviewMap = new Map<string, Date>()
  for (const row of lastReviewDates) {
    if (row.productId && row.lastReviewAt) {
      lastReviewMap.set(row.productId, new Date(row.lastReviewAt))
    }
  }

  // Combine data
  return allProducts.map(p => ({
    id: p.id,
    name: p.name,
    reviewCount: p.reviewCount ?? 0,
    lastReviewAt: lastReviewMap.get(p.id) ?? null,
  }))
}

/**
 * Calculate scores for all products based on shop settings
 */
function calculateProductScores(
  products: Array<{
    id: string
    name: string
    reviewCount: number
    lastReviewAt: Date | null
  }>,
  settings: {
    priorityBestsellers: number
    priorityNoReviews: number
    priorityStale: number
    staleDaysThreshold: number
  }
): ScoredProduct[] {
  const now = new Date()
  const scoredProducts: ScoredProduct[] = []

  for (const product of products) {
    let score = 0
    let reason: 'bestseller' | 'no_reviews' | 'stale' = 'no_reviews'

    // Calculate days since last review
    const daysSinceLastReview = product.lastReviewAt
      ? Math.floor((now.getTime() - product.lastReviewAt.getTime()) / (1000 * 60 * 60 * 24))
      : Infinity

    // Priority 1: No reviews (reviewCount = 0)
    if (product.reviewCount === 0) {
      score = 10 * (settings.priorityNoReviews / 100)
      reason = 'no_reviews'
    }
    // Priority 2: Bestsellers (reviewCount > 5)
    else if (product.reviewCount > 5) {
      score = product.reviewCount * (settings.priorityBestsellers / 100)
      reason = 'bestseller'
    }
    // Priority 3: Stale (last review > threshold days ago)
    else if (daysSinceLastReview > settings.staleDaysThreshold) {
      score = daysSinceLastReview * (settings.priorityStale / 100)
      reason = 'stale'
    }
    // Default: some score based on staleness or low review count
    else {
      // Give a base score to products with few reviews
      score = Math.max(1, 5 - product.reviewCount) * (settings.priorityNoReviews / 100)
      reason = 'no_reviews'
    }

    // Only include products with a positive score
    if (score > 0) {
      scoredProducts.push({
        id: product.id,
        name: product.name,
        reason,
        score,
      })
    }
  }

  return scoredProducts
}

/**
 * Weighted random selection of products
 * Higher scores = higher chance of selection
 */
function weightedRandomSelect(
  products: ScoredProduct[],
  count: number
): ProductSelection[] {
  const selected: ProductSelection[] = []
  const available = [...products]

  for (let i = 0; i < count && available.length > 0; i++) {
    // Calculate total weight
    const totalWeight = available.reduce((sum, p) => sum + p.score, 0)
    
    if (totalWeight === 0) break

    // Random weighted selection
    let random = Math.random() * totalWeight
    let selectedIndex = 0

    for (let j = 0; j < available.length; j++) {
      random -= available[j].score
      if (random <= 0) {
        selectedIndex = j
        break
      }
    }

    // Add to selected
    const product = available[selectedIndex]
    selected.push({
      productId: product.id,
      productName: product.name,
      reason: product.reason,
      score: product.score,
    })

    // Remove from available to avoid duplicates
    available.splice(selectedIndex, 1)
  }

  return selected
}

/**
 * Select products for review generation based on shop settings
 * 
 * @param shopId - The shop ID to select products for
 * @param count - Number of products to select
 * @returns Array of selected products with reasons
 */
export async function selectProductsForShop(
  shopId: string,
  count: number
): Promise<ProductSelection[]> {
  console.log(`[ProductSelector] Selecting ${count} products for shop ${shopId}`)

  // Get shop settings
  const settings = await getShopSettings(shopId)
  console.log('[ProductSelector] Settings:', settings)

  // Get products with review stats
  const productsWithStats = await getProductsWithStats(shopId)
  console.log(`[ProductSelector] Found ${productsWithStats.length} products`)

  if (productsWithStats.length === 0) {
    console.log('[ProductSelector] No products found')
    return []
  }

  // Calculate scores
  const scoredProducts = calculateProductScores(productsWithStats, settings)
  console.log(`[ProductSelector] ${scoredProducts.length} products have positive scores`)

  // Select products using weighted random
  const selections = weightedRandomSelect(scoredProducts, count)
  console.log(`[ProductSelector] Selected ${selections.length} products:`)
  
  for (const s of selections) {
    console.log(`  - ${s.productName} (${s.reason}, score: ${s.score.toFixed(2)})`)
  }

  return selections
}

/**
 * Get products that recently had reviews generated (to avoid duplicates)
 */
export async function getRecentlyGeneratedProductIds(
  shopId: string,
  daysBack: number = 7
): Promise<Set<string>> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - daysBack)

  const recentReviews = await db
    .select({ productId: reviews.productId })
    .from(reviews)
    .where(
      and(
        eq(reviews.shopId, shopId),
        sql`${reviews.createdAt} > ${cutoff.toISOString()}`,
        isNotNull(reviews.productId)
      )
    )

  return new Set(recentReviews.map(r => r.productId!))
}

/**
 * Select products avoiding recently generated ones
 */
export async function selectProductsAvoidingRecent(
  shopId: string,
  count: number,
  daysBack: number = 7
): Promise<ProductSelection[]> {
  // Get recent product IDs
  const recentIds = await getRecentlyGeneratedProductIds(shopId, daysBack)
  console.log(`[ProductSelector] Avoiding ${recentIds.size} recently used products`)

  // Get all selections
  const allSelections = await selectProductsForShop(shopId, count + recentIds.size)

  // Filter out recent ones
  const filtered = allSelections.filter(s => !recentIds.has(s.productId))

  // Return up to requested count
  return filtered.slice(0, count)
}
