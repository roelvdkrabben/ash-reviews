/**
 * Lightspeed eCom API Client
 * 
 * Docs: https://developers.lightspeedhq.com/ecom/
 * Base URL: https://api.webshopapp.com/{language}/
 * Auth: Basic Auth with API key:secret
 * Rate limit: 300 requests per 5 min
 */

// Types for Lightspeed API responses
export interface LightspeedShop {
  id: number
  createdAt: string
  updatedAt: string
  name: string
  email: string
  country: {
    code: string
    title: string
  }
  currency: {
    code: string
    symbol: string
  }
}

export interface LightspeedProduct {
  id: number
  createdAt: string
  updatedAt: string
  isVisible: boolean
  visibility: 'hidden' | 'visible' | 'auto'
  url: string
  title: string
  fulltitle: string
  description: string
  content: string
  image?: {
    thumb: string
    src: string
  }
  brand?: {
    resource: {
      id: number
      url: string
    }
  }
  categories?: {
    resource: {
      url: string
    }
  }
  variants?: {
    resource: {
      url: string
    }
  }
}

export interface LightspeedVariant {
  id: number
  createdAt: string
  updatedAt: string
  isDefault: boolean
  sortOrder: number
  articleCode: string
  ean: string
  sku: string
  priceExcl: number
  priceIncl: number
  priceCost: number
  oldPriceExcl: number
  oldPriceIncl: number
  stockLevel: number
  title: string
  product?: {
    resource: {
      id: number
    }
  }
}

export interface LightspeedCategory {
  id: number
  createdAt: string
  updatedAt: string
  isVisible: boolean
  depth: number
  sortOrder: number
  url: string
  title: string
  fulltitle: string
}

export interface LightspeedReview {
  id: number
  createdAt: string
  updatedAt: string
  isVisible: boolean
  score: number
  name: string
  content: string
  language?: {
    id: number
    code: string
    locale: string
    title: string
  }
  product?: {
    resource: {
      id: number
      url: string
    }
  }
}

export interface LightspeedReviewInput {
  score: number
  name: string
  content: string
  isVisible?: boolean
  language?: string
}

export class LightspeedError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: unknown
  ) {
    super(message)
    this.name = 'LightspeedError'
  }
}

export class LightspeedClient {
  private baseUrl: string
  private authHeader: string

  constructor(
    private apiKey: string,
    private apiSecret: string,
    private language: string = 'nl'
  ) {
    this.baseUrl = `https://api.webshopapp.com/${language}`
    this.authHeader = 'Basic ' + Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': this.authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers,
      },
    })

    // Handle rate limiting
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After')
      throw new LightspeedError(
        `Rate limited. Retry after ${retryAfter || 'unknown'} seconds`,
        429
      )
    }

    if (!response.ok) {
      const errorBody = await response.text()
      throw new LightspeedError(
        `Lightspeed API error: ${response.status} ${response.statusText}`,
        response.status,
        errorBody
      )
    }

    return response.json() as Promise<T>
  }

  /**
   * Get shop information
   */
  async getShop(): Promise<LightspeedShop> {
    const data = await this.request<{ shop: LightspeedShop }>('/shop.json')
    return data.shop
  }

  /**
   * Get all products with pagination
   */
  async getProducts(limit: number = 50, page: number = 1): Promise<LightspeedProduct[]> {
    // Max limit is 250
    const safeLimit = Math.min(limit, 250)
    const data = await this.request<{ products: LightspeedProduct[] }>(
      `/products.json?limit=${safeLimit}&page=${page}`
    )
    return data.products || []
  }

  /**
   * Get all products (handles pagination automatically)
   */
  async getAllProducts(): Promise<LightspeedProduct[]> {
    const allProducts: LightspeedProduct[] = []
    let page = 1
    const limit = 250 // Max allowed

    while (true) {
      const products = await this.getProducts(limit, page)
      if (products.length === 0) break
      
      allProducts.push(...products)
      
      // If we got less than the limit, we're done
      if (products.length < limit) break
      
      page++
      
      // Safety limit to prevent infinite loops
      if (page > 100) break
    }

    return allProducts
  }

  /**
   * Get a single product by ID
   */
  async getProduct(id: number): Promise<LightspeedProduct> {
    const data = await this.request<{ product: LightspeedProduct }>(
      `/products/${id}.json`
    )
    return data.product
  }

  /**
   * Get variants for a product (contains pricing info)
   */
  async getVariants(productId: number): Promise<LightspeedVariant[]> {
    const data = await this.request<{ variants: LightspeedVariant[] }>(
      `/variants.json?product=${productId}`
    )
    return data.variants || []
  }

  /**
   * Get all categories
   */
  async getCategories(): Promise<LightspeedCategory[]> {
    const data = await this.request<{ categories: LightspeedCategory[] }>(
      '/categories.json?limit=250'
    )
    return data.categories || []
  }

  /**
   * Get reviews with pagination
   */
  async getReviewsPage(productId?: number, limit: number = 250, page: number = 1): Promise<LightspeedReview[]> {
    const safeLimit = Math.min(limit, 250)
    const endpoint = productId 
      ? `/reviews.json?product=${productId}&limit=${safeLimit}&page=${page}`
      : `/reviews.json?limit=${safeLimit}&page=${page}`
    
    const data = await this.request<{ reviews: LightspeedReview[] }>(endpoint)
    return data.reviews || []
  }

  /**
   * Get all reviews (handles pagination automatically)
   */
  async getReviews(productId?: number): Promise<LightspeedReview[]> {
    const allReviews: LightspeedReview[] = []
    let page = 1
    const limit = 250 // Max allowed

    while (true) {
      const reviews = await this.getReviewsPage(productId, limit, page)
      if (reviews.length === 0) break
      
      allReviews.push(...reviews)
      
      // If we got less than the limit, we're done
      if (reviews.length < limit) break
      
      page++
      
      // Safety limit to prevent infinite loops
      if (page > 100) break
    }

    return allReviews
  }

  /**
   * Get total review count for a product
   */
  async getReviewCount(productId: number): Promise<number> {
    const data = await this.request<{ count: number }>(
      `/reviews/count.json?product=${productId}`
    )
    return data.count
  }

  /**
   * Create a new review
   */
  async createReview(
    productId: number,
    review: LightspeedReviewInput
  ): Promise<LightspeedReview> {
    const data = await this.request<{ review: LightspeedReview }>(
      '/reviews.json',
      {
        method: 'POST',
        body: JSON.stringify({
          review: {
            product: productId,
            score: review.score,
            name: review.name,
            content: review.content,
            isVisible: review.isVisible ?? true,
            language: review.language || this.language,
          },
        }),
      }
    )
    return data.review
  }

  /**
   * Test connection by fetching shop info
   */
  async testConnection(): Promise<{ success: boolean; shop?: LightspeedShop; error?: string }> {
    try {
      const shop = await this.getShop()
      return { success: true, shop }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }
}

/**
 * Create a Lightspeed client from shop credentials
 */
export function createLightspeedClient(
  apiKey: string,
  apiSecret: string,
  language: string = 'nl'
): LightspeedClient {
  return new LightspeedClient(apiKey, apiSecret, language)
}
