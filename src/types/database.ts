export interface Shop {
  id: string
  name: string
  slug: string
  domain: string
  lightspeed_api_key?: string
  lightspeed_api_secret?: string
  settings: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface Product {
  id: string
  shop_id: string
  external_id: string
  name: string
  description?: string
  category?: string
  price?: number
  image_url?: string
  review_count: number
  avg_rating?: number
  priority: number
  synced_at?: string
  created_at: string
}

export interface Review {
  id: string
  shop_id: string
  product_id: string
  status: 'pending' | 'approved' | 'posted' | 'failed'
  reviewer_name: string
  rating: number
  title?: string
  content: string
  source_reviews?: string[]
  scheduled_at?: string
  posted_at?: string
  external_id?: string
  created_at: string
  updated_at: string
}

export interface GenerationJob {
  id: string
  shop_id: string
  product_id?: string
  status: string
  target_count: number
  generated_count: number
  error?: string
  created_at: string
  completed_at?: string
}

export interface Database {
  public: {
    Tables: {
      shops: {
        Row: Shop
        Insert: Omit<Shop, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Shop, 'id' | 'created_at'>>
      }
      products: {
        Row: Product
        Insert: Omit<Product, 'id' | 'created_at'>
        Update: Partial<Omit<Product, 'id' | 'created_at'>>
      }
      reviews: {
        Row: Review
        Insert: Omit<Review, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Review, 'id' | 'created_at'>>
      }
      generation_jobs: {
        Row: GenerationJob
        Insert: Omit<GenerationJob, 'id' | 'created_at'>
        Update: Partial<Omit<GenerationJob, 'id' | 'created_at'>>
      }
    }
  }
}
