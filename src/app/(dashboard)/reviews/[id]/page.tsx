import { db } from '@/lib/db'
import { reviews, products, shops } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ReviewEditForm } from './ReviewEditForm'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ReviewDetailPage({ params }: PageProps) {
  const { id } = await params

  const [result] = await db
    .select({
      review: reviews,
      product: products,
      shop: shops
    })
    .from(reviews)
    .leftJoin(products, eq(reviews.productId, products.id))
    .leftJoin(shops, eq(reviews.shopId, shops.id))
    .where(eq(reviews.id, id))
    .limit(1)

  if (!result) {
    notFound()
  }

  const { review, product, shop } = result

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back link */}
      <Link 
        href="/reviews" 
        className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
      >
        <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Terug naar reviews
      </Link>

      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Review bewerken</h1>
            {product && (
              <p className="text-sm text-gray-500 mt-1">
                Product: {product.name}
              </p>
            )}
            {shop && (
              <p className="text-xs text-gray-400">
                Shop: {shop.name}
              </p>
            )}
          </div>
          <StatusBadge status={review.status} />
        </div>

        <ReviewEditForm review={review} />
      </div>

      {/* Meta info */}
      <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-500">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="font-medium">Aangemaakt:</span>{' '}
            {new Date(review.createdAt!).toLocaleString('nl-NL')}
          </div>
          <div>
            <span className="font-medium">Laatst bijgewerkt:</span>{' '}
            {new Date(review.updatedAt!).toLocaleString('nl-NL')}
          </div>
          {review.scheduledAt && (
            <div>
              <span className="font-medium">Gepland voor:</span>{' '}
              {new Date(review.scheduledAt).toLocaleString('nl-NL')}
            </div>
          )}
          {review.postedAt && (
            <div>
              <span className="font-medium">Gepost op:</span>{' '}
              {new Date(review.postedAt).toLocaleString('nl-NL')}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-blue-100 text-blue-800',
    posted: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
  }
  
  const labels: Record<string, string> = {
    pending: 'Wachtend',
    approved: 'Goedgekeurd',
    posted: 'Gepost',
    failed: 'Mislukt',
  }

  return (
    <span className={`px-3 py-1 text-sm font-medium rounded-full ${colors[status] || colors.pending}`}>
      {labels[status] || status}
    </span>
  )
}
