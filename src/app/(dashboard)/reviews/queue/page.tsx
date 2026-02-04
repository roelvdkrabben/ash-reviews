import { db } from '@/lib/db'
import { reviews, products, shops, productQueue } from '@/lib/schema'
import { desc, eq, and, asc } from 'drizzle-orm'
import { ReviewQueueClient } from './ReviewQueueClient'
import { ProductQueueClient } from './ProductQueueClient'
import { QueueTabs } from './QueueTabs'

interface PageProps {
  searchParams: Promise<{ shop?: string; tab?: string }>
}

export default async function ReviewQueuePage({ searchParams }: PageProps) {
  const params = await searchParams
  const shopFilter = params.shop || 'all'
  const activeTab = params.tab || 'reviews'

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
  let reviewError: string | null = null

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
    reviewError = e instanceof Error ? e.message : 'Onbekende fout'
  }

  // Calculate review stats
  let reviewStats = { pending: 0, approved: 0, scheduled: 0, posted: 0 }
  try {
    const allReviews = await db.select({ status: reviews.status, scheduledAt: reviews.scheduledAt }).from(reviews)
    reviewStats = {
      pending: allReviews.filter(r => r.status === 'pending').length,
      approved: allReviews.filter(r => r.status === 'approved' && !r.scheduledAt).length,
      scheduled: allReviews.filter(r => r.status === 'approved' && r.scheduledAt).length,
      posted: allReviews.filter(r => r.status === 'posted').length,
    }
  } catch (e) {
    console.error('Error fetching review stats:', e)
  }

  // Fetch product queue items
  let queueList: Array<{
    queueItem: typeof productQueue.$inferSelect
    product: typeof products.$inferSelect | null
    shop: typeof shops.$inferSelect | null
  }> = []
  let queueError: string | null = null

  try {
    const queueQuery = db
      .select({
        queueItem: productQueue,
        product: products,
        shop: shops,
      })
      .from(productQueue)
      .leftJoin(products, eq(productQueue.productId, products.id))
      .leftJoin(shops, eq(productQueue.shopId, shops.id))

    if (shopFilter !== 'all') {
      queueList = await queueQuery
        .where(eq(productQueue.shopId, shopFilter))
        .orderBy(desc(productQueue.priority), asc(productQueue.addedAt))
        .limit(200)
    } else {
      queueList = await queueQuery
        .orderBy(desc(productQueue.priority), asc(productQueue.addedAt))
        .limit(200)
    }
  } catch (e) {
    queueError = e instanceof Error ? e.message : 'Onbekende fout'
  }

  // Calculate queue stats
  let queueStats = { pending: 0, generating: 0, completed: 0, failed: 0 }
  try {
    const allQueueItems = await db.select({ status: productQueue.status }).from(productQueue)
    queueStats = {
      pending: allQueueItems.filter(i => i.status === 'pending').length,
      generating: allQueueItems.filter(i => i.status === 'generating').length,
      completed: allQueueItems.filter(i => i.status === 'completed').length,
      failed: allQueueItems.filter(i => i.status === 'failed').length,
    }
  } catch (e) {
    console.error('Error fetching queue stats:', e)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📋 Wachtrijen</h1>
          <p className="text-gray-600 mt-1">Beheer reviews en producten voor review generatie</p>
        </div>
      </div>

      {/* Tabs */}
      <QueueTabs 
        activeTab={activeTab} 
        reviewCount={reviewStats.pending}
        productCount={queueStats.pending}
      />

      {activeTab === 'reviews' ? (
        <>
          {/* Review Stats bar */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-yellow-700">{reviewStats.pending}</div>
              <div className="text-sm text-yellow-600">Pending</div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-blue-700">{reviewStats.approved}</div>
              <div className="text-sm text-blue-600">Goedgekeurd</div>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-purple-700">{reviewStats.scheduled}</div>
              <div className="text-sm text-purple-600">Ingepland</div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-700">{reviewStats.posted}</div>
              <div className="text-sm text-green-600">Gepost</div>
            </div>
          </div>

          {reviewError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              Fout bij laden: {reviewError}
            </div>
          )}

          <ReviewQueueClient 
            reviews={reviewList} 
            shops={shopList}
            currentShopFilter={shopFilter}
          />
        </>
      ) : (
        <>
          {/* Product Queue Stats bar */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-yellow-700">{queueStats.pending}</div>
              <div className="text-sm text-yellow-600">⏳ Wacht</div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-blue-700">{queueStats.generating}</div>
              <div className="text-sm text-blue-600">✍️ Genereren</div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-700">{queueStats.completed}</div>
              <div className="text-sm text-green-600">✅ Klaar</div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-red-700">{queueStats.failed}</div>
              <div className="text-sm text-red-600">❌ Mislukt</div>
            </div>
          </div>

          {queueError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              Fout bij laden: {queueError}
            </div>
          )}

          <ProductQueueClient 
            queueItems={queueList}
            shops={shopList}
            currentShopFilter={shopFilter}
            stats={queueStats}
          />
        </>
      )}
    </div>
  )
}
