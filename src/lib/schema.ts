import { pgTable, uuid, text, timestamp, jsonb, decimal, integer, uniqueIndex, index } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// Shops table
export const shops = pgTable('shops', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  domain: text('domain').notNull(),
  lightspeedApiKey: text('lightspeed_api_key'),
  lightspeedApiSecret: text('lightspeed_api_secret'),
  settings: jsonb('settings').default({}),
  lastProductsSync: timestamp('last_products_sync', { withTimezone: true }),
  lastReviewsSync: timestamp('last_reviews_sync', { withTimezone: true }),
  // Review workflow settings
  reviewsPerWeek: integer('reviews_per_week').default(10),
  activeDays: text('active_days').array().default(['tue', 'wed', 'thu', 'sat']),
  timeSlotStart: text('time_slot_start').default('09:00'),
  timeSlotEnd: text('time_slot_end').default('21:00'),
  minHoursBetween: integer('min_hours_between').default(4),
  priorityBestsellers: integer('priority_bestsellers').default(60),
  priorityNoReviews: integer('priority_no_reviews').default(25),
  priorityStale: integer('priority_stale').default(15),
  staleDaysThreshold: integer('stale_days_threshold').default(30),
  autoGenerate: text('auto_generate').default('false').$type<'true' | 'false'>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// Products table
export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  shopId: uuid('shop_id').references(() => shops.id, { onDelete: 'cascade' }),
  externalId: text('external_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  category: text('category'),
  price: decimal('price', { precision: 10, scale: 2 }),
  imageUrl: text('image_url'),
  reviewCount: integer('review_count').default(0),
  avgRating: decimal('avg_rating', { precision: 2, scale: 1 }),
  priority: integer('priority').default(0),
  syncedAt: timestamp('synced_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  uniqueIndex('products_shop_external_idx').on(table.shopId, table.externalId),
  index('products_shop_id_idx').on(table.shopId),
])

// Reviews table
export const reviews = pgTable('reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  shopId: uuid('shop_id').references(() => shops.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'cascade' }),
  status: text('status').default('pending').notNull(), // pending, approved, rejected, posted, failed, imported (imported = existing reviews from Lightspeed)
  reviewerName: text('reviewer_name').notNull(),
  rating: integer('rating').notNull(),
  title: text('title'),
  content: text('content').notNull(),
  sourceReviews: text('source_reviews').array(),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  postedAt: timestamp('posted_at', { withTimezone: true }),
  externalId: text('external_id'),
  // Review workflow fields
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  approvedBy: text('approved_by'),
  rejectedAt: timestamp('rejected_at', { withTimezone: true }),
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('reviews_shop_id_idx').on(table.shopId),
  index('reviews_product_id_idx').on(table.productId),
  index('reviews_status_idx').on(table.status),
])

// Generation jobs table
export const generationJobs = pgTable('generation_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  shopId: uuid('shop_id').references(() => shops.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').references(() => products.id),
  status: text('status').default('pending'),
  targetCount: integer('target_count').default(1),
  generatedCount: integer('generated_count').default(0),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
}, (table) => [
  index('generation_jobs_shop_id_idx').on(table.shopId),
])

// Relations
export const shopsRelations = relations(shops, ({ many }) => ({
  products: many(products),
  reviews: many(reviews),
  generationJobs: many(generationJobs),
}))

export const productsRelations = relations(products, ({ one, many }) => ({
  shop: one(shops, {
    fields: [products.shopId],
    references: [shops.id],
  }),
  reviews: many(reviews),
}))

export const reviewsRelations = relations(reviews, ({ one }) => ({
  shop: one(shops, {
    fields: [reviews.shopId],
    references: [shops.id],
  }),
  product: one(products, {
    fields: [reviews.productId],
    references: [products.id],
  }),
}))

export const generationJobsRelations = relations(generationJobs, ({ one }) => ({
  shop: one(shops, {
    fields: [generationJobs.shopId],
    references: [shops.id],
  }),
  product: one(products, {
    fields: [generationJobs.productId],
    references: [products.id],
  }),
}))

// Types
export type Shop = typeof shops.$inferSelect
export type NewShop = typeof shops.$inferInsert
export type Product = typeof products.$inferSelect
export type NewProduct = typeof products.$inferInsert
export type Review = typeof reviews.$inferSelect
export type NewReview = typeof reviews.$inferInsert
export type GenerationJob = typeof generationJobs.$inferSelect
export type NewGenerationJob = typeof generationJobs.$inferInsert
