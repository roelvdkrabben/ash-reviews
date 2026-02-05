import { db } from '@/lib/db'
import { reviews, products, shops } from '@/lib/schema'
import { desc, eq, and } from 'drizzle-orm'
import Link from 'next/link'
import { ReviewActions } from './ReviewActions'
import { ReviewFilters } from './ReviewFilters'

interface PageProps {
  searchParams: Promise<{ status?: string }>
}

export default async function ReviewsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const statusFilter = params.status || 'all'

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

    if (statusFilter !== 'all') {
      reviewList = await baseQuery
        .where(eq(reviews.status, statusFilter))
        .orderBy(desc(reviews.createdAt))
        .limit(100)
    } else {
      reviewList = await baseQuery
        .orderBy(desc(reviews.createdAt))
        .limit(100)
    }
  } catch (e) {
    error = e instanceof Error ? e.message : 'Onbekende fout'
  }

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-blue-100 text-blue-800',
    posted: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    imported: 'bg-purple-100 text-purple-800',
  }

  const statusLabels = {
    pending: 'Wachtend',
    approved: 'Goedgekeurd',
    posted: 'Gepost',
    failed: 'Mislukt',
    imported: 'Geïmporteerd',
  }

  // Count by status
  const counts = {
    all: reviewList.length,
    pending: reviewList.filter(r => r.review.status === 'pending').length,
    approved: reviewList.filter(r => r.review.status === 'approved').length,
    posted: reviewList.filter(r => r.review.status === 'posted').length,
    imported: reviewList.filter(r => r.review.status === 'imported').length,
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reviews</h1>
          <p className="text-gray-600 mt-1">Beheer en keur gegenereerde reviews goed</p>
        </div>
      </div>

      {/* Filter tabs */}
      <ReviewFilters currentStatus={statusFilter} counts={counts} />

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          Fout bij laden: {error}
        </div>
      )}

      {!error && reviewList.length === 0 && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-gray-400 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Geen reviews</h3>
          <p className="text-gray-500">
            {statusFilter === 'all' 
              ? 'Er zijn nog geen reviews gegenereerd.' 
              : `Geen reviews met status "${statusLabels[statusFilter as keyof typeof statusLabels] || statusFilter}".`}
          </p>
        </div>
      )}

      {reviewList.length > 0 && (
        <div className="space-y-4">
          {reviewList.map(({ review, product, shop }) => (
            <div key={review.id} className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[review.status as keyof typeof statusColors] || statusColors.pending}`}>
                      {review.status === 'imported' && (
                        <svg className="inline-block w-3 h-3 mr-1 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                      )}
                      {statusLabels[review.status as keyof typeof statusLabels] || review.status}
                    </span>
                    <div className="flex items-center">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <svg
                          key={star}
                          className={`w-4 h-4 ${star <= review.rating ? 'text-yellow-400' : 'text-gray-300'}`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                    <span className="text-sm text-gray-500">{review.reviewerName}</span>
                  </div>
                  
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    {shop && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-700">
                        {shop.name}
                      </span>
                    )}
                    {product && (
                      product.url ? (
                        <a 
                          href={product.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {product.name}
                        </a>
                      ) : (
                        <span className="text-xs text-gray-600">
                          {product.name}
                        </span>
                      )
                    )}
                  </div>
                  
                  {review.title && (
                    <h3 className="font-medium text-gray-900 mb-1">{review.title}</h3>
                  )}
                  <p className="text-gray-700">{review.content}</p>
                  
                  <p className="text-xs text-gray-400 mt-2">
                    {new Date(review.createdAt!).toLocaleDateString('nl-NL', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
                
                <div className="flex items-center gap-2 ml-4">
                  <Link 
                    href={`/reviews/${review.id}`}
                    className="px-3 py-1 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                  >
                    Bekijk
                  </Link>
                  {review.status === 'pending' && (
                    <ReviewActions reviewId={review.id} />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
