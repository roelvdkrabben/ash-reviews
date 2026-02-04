import { db } from '@/lib/db'
import { reviews, products, shops } from '@/lib/schema'
import { desc, eq, and } from 'drizzle-orm'
import { ReviewQueueClient } from './ReviewQueueClient'

interface PageProps {
  searchParams: Promise<{ shop?: string }>
}

export default async function ReviewQueuePage({ searchParams }: PageProps) {
  const params = await searchParams
  const shopFilter = params.shop || 'all'

  // Fetch all shops for dropdown
  let shopList: Array<typeof shops.$inferSelect> = []
  try {
    shopList = await db.select().from(shops).orderBy(shops.name)
  } catch (e) {
    console.error('Error fetching shops:', e)
  }

  // Fetch pending reviews
  let reviewList: Array<{
    review: typeof reviews.$inferSelect
    product: typeof products.$inferSelect | null
    shop: typeof shops.$inferSelect | null
  }> = []
  let error: string | null = null

  try {
    const baseQuery = db
      .select({
        review: reviews,
        product: products,
        shop: shops,
      })
      .from(reviews)
      .leftJoin(products, eq(reviews.productId, products.id))
      .leftJoin(shops, eq(reviews.shopId, shops.id))

    if (shopFilter !== 'all') {
      reviewList = await baseQuery
        .where(and(
          eq(reviews.status, 'pending'),
          eq(reviews.shopId, shopFilter)
        ))
        .orderBy(desc(reviews.createdAt))
        .limit(100)
    } else {
      reviewList = await baseQuery
        .where(eq(reviews.status, 'pending'))
        .orderBy(desc(reviews.createdAt))
        .limit(100)
    }
  } catch (e) {
    error = e instanceof Error ? e.message : 'Onbekende fout'
  }

  // Calculate stats
  let stats = { pending: 0, approved: 0, scheduled: 0, posted: 0 }
  try {
    const allReviews = await db.select({ status: reviews.status, scheduledAt: reviews.scheduledAt }).from(reviews)
    stats = {
      pending: allReviews.filter(r => r.status === 'pending').length,
      approved: allReviews.filter(r => r.status === 'approved' && !r.scheduledAt).length,
      scheduled: allReviews.filter(r => r.status === 'approved' && r.scheduledAt).length,
      posted: allReviews.filter(r => r.status === 'posted').length,
    }
  } catch (e) {
    console.error('Error fetching stats:', e)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📋 Review Wachtrij</h1>
          <p className="text-gray-600 mt-1">Keur reviews goed of af met keyboard shortcuts</p>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-yellow-700">{stats.pending}</div>
          <div className="text-sm text-yellow-600">Pending</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-700">{stats.approved}</div>
          <div className="text-sm text-blue-600">Goedgekeurd</div>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-purple-700">{stats.scheduled}</div>
          <div className="text-sm text-purple-600">Ingepland</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-700">{stats.posted}</div>
          <div className="text-sm text-green-600">Gepost</div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          Fout bij laden: {error}
        </div>
      )}

      <ReviewQueueClient 
        reviews={reviewList} 
        shops={shopList}
        currentShopFilter={shopFilter}
      />
    </div>
  )
}
