/**
 * Product Sync Service
 * 
 * Syncs products from Lightspeed eCom to our database
 */

import { db } from './db'
import { shops, products } from './schema'
import { eq, and } from 'drizzle-orm'
import { createLightspeedClient, LightspeedProduct, LightspeedError } from './lightspeed'

export interface SyncResult {
  success: boolean
  shopId: string
  productsCreated: number
  productsUpdated: number
  totalProducts: number
  error?: string
  duration?: number
}

export interface ProductSyncData {
  externalId: string
  name: string
  description: string | null
  category: string | null
  price: string | null
  imageUrl: string | null
  syncedAt: Date
}

/**
 * Map a Lightspeed product to our database format
 */
function mapLightspeedProduct(
  lsProduct: LightspeedProduct,
  defaultPrice?: number
): ProductSyncData {
  return {
    externalId: String(lsProduct.id),
    name: lsProduct.fulltitle || lsProduct.title,
    description: lsProduct.description || null,
    category: null, // Categories need separate fetch, kept simple for now
    price: defaultPrice ? String(defaultPrice) : null,
    imageUrl: lsProduct.image?.src || null,
    syncedAt: new Date(),
  }
}

/**
 * Sync all products for a shop
 */
export async function syncProducts(shopId: string): Promise<SyncResult> {
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
        productsCreated: 0,
        productsUpdated: 0,
        totalProducts: 0,
        error: 'Shop niet gevonden',
      }
    }

    if (!shop.lightspeedApiKey || !shop.lightspeedApiSecret) {
      return {
        success: false,
        shopId,
        productsCreated: 0,
        productsUpdated: 0,
        totalProducts: 0,
        error: 'Lightspeed API credentials niet geconfigureerd',
      }
    }

    // Create Lightspeed client
    const client = createLightspeedClient(
      shop.lightspeedApiKey,
      shop.lightspeedApiSecret,
      'nl'
    )

    // Test connection first
    const connectionTest = await client.testConnection()
    if (!connectionTest.success) {
      return {
        success: false,
        shopId,
        productsCreated: 0,
        productsUpdated: 0,
        totalProducts: 0,
        error: `API connectie mislukt: ${connectionTest.error}`,
      }
    }

    // Fetch all products from Lightspeed
    const lsProducts = await client.getAllProducts()

    // Get existing products for this shop
    const existingProducts = await db
      .select({ externalId: products.externalId, id: products.id })
      .from(products)
      .where(eq(products.shopId, shopId))

    const existingMap = new Map(
      existingProducts.map(p => [p.externalId, p.id])
    )

    let created = 0
    let updated = 0

    // Process each product
    for (const lsProduct of lsProducts) {
      // Skip invisible products
      if (!lsProduct.isVisible) continue

      // Get price from first variant (default variant)
      let price: number | undefined
      try {
        const variants = await client.getVariants(lsProduct.id)
        const defaultVariant = variants.find(v => v.isDefault) || variants[0]
        if (defaultVariant) {
          price = defaultVariant.priceIncl
        }
      } catch {
        // Ignore variant fetch errors, continue without price
      }

      const productData = mapLightspeedProduct(lsProduct, price)
      const existingId = existingMap.get(productData.externalId)

      if (existingId) {
        // Update existing product
        await db
          .update(products)
          .set({
            name: productData.name,
            description: productData.description,
            category: productData.category,
            price: productData.price,
            imageUrl: productData.imageUrl,
            syncedAt: productData.syncedAt,
          })
          .where(eq(products.id, existingId))
        updated++
      } else {
        // Create new product
        await db.insert(products).values({
          shopId,
          externalId: productData.externalId,
          name: productData.name,
          description: productData.description,
          category: productData.category,
          price: productData.price,
          imageUrl: productData.imageUrl,
          syncedAt: productData.syncedAt,
        })
        created++
      }
    }

    return {
      success: true,
      shopId,
      productsCreated: created,
      productsUpdated: updated,
      totalProducts: created + updated,
      duration: Date.now() - startTime,
    }
  } catch (error) {
    console.error('Sync error:', error)
    
    let errorMessage = 'Onbekende fout'
    if (error instanceof LightspeedError) {
      errorMessage = `Lightspeed API fout (${error.statusCode}): ${error.message}`
    } else if (error instanceof Error) {
      errorMessage = error.message
    }

    return {
      success: false,
      shopId,
      productsCreated: 0,
      productsUpdated: 0,
      totalProducts: 0,
      error: errorMessage,
      duration: Date.now() - startTime,
    }
  }
}

/**
 * Sync products for all shops that have API credentials
 */
export async function syncAllShops(): Promise<SyncResult[]> {
  const allShops = await db
    .select({ id: shops.id })
    .from(shops)
    .where(
      and(
        // Only shops with API credentials
        // Using raw SQL would be cleaner but let's keep it simple
      )
    )

  // Filter shops with credentials
  const shopsWithCredentials = await db
    .select()
    .from(shops)

  const results: SyncResult[] = []

  for (const shop of shopsWithCredentials) {
    if (shop.lightspeedApiKey && shop.lightspeedApiSecret) {
      const result = await syncProducts(shop.id)
      results.push(result)
    }
  }

  return results
}

/**
 * Update review count for a product from Lightspeed
 */
export async function syncProductReviewCount(
  shopId: string,
  productExternalId: string
): Promise<{ success: boolean; reviewCount?: number; error?: string }> {
  try {
    const [shop] = await db
      .select()
      .from(shops)
      .where(eq(shops.id, shopId))
      .limit(1)

    if (!shop?.lightspeedApiKey || !shop?.lightspeedApiSecret) {
      return { success: false, error: 'API credentials niet gevonden' }
    }

    const client = createLightspeedClient(
      shop.lightspeedApiKey,
      shop.lightspeedApiSecret,
      'nl'
    )

    const reviewCount = await client.getReviewCount(Number(productExternalId))

    // Update product in database
    await db
      .update(products)
      .set({ reviewCount })
      .where(
        and(
          eq(products.shopId, shopId),
          eq(products.externalId, productExternalId)
        )
      )

    return { success: true, reviewCount }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Onbekende fout',
    }
  }
}
