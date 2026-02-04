import { createClient } from '@/lib/supabase/server'

export default async function ReviewsPage() {
  const supabase = await createClient()
  
  const { data: reviews, error } = await supabase
    .from('reviews')
    .select(`
      *,
      products (name, image_url),
      shops (name)
    `)
    .order('created_at', { ascending: false })
    .limit(50)

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-blue-100 text-blue-800',
    posted: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
  }

  const statusLabels = {
    pending: 'Wachtend',
    approved: 'Goedgekeurd',
    posted: 'Gepost',
    failed: 'Mislukt',
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
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <a href="#" className="border-blue-500 text-blue-600 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm">
            Alle
          </a>
          <a href="#" className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm">
            Wachtend
          </a>
          <a href="#" className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm">
            Goedgekeurd
          </a>
          <a href="#" className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm">
            Gepost
          </a>
        </nav>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          Fout bij laden: {error.message}
        </div>
      )}

      {!error && (!reviews || reviews.length === 0) && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-gray-400 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Geen reviews</h3>
          <p className="text-gray-500">Er zijn nog geen reviews gegenereerd.</p>
        </div>
      )}

      {reviews && reviews.length > 0 && (
        <div className="space-y-4">
          {reviews.map((review) => (
            <div key={review.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[review.status as keyof typeof statusColors]}`}>
                      {statusLabels[review.status as keyof typeof statusLabels]}
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
                    <span className="text-sm text-gray-500">{review.reviewer_name}</span>
                  </div>
                  {review.title && (
                    <h3 className="font-medium text-gray-900 mb-1">{review.title}</h3>
                  )}
                  <p className="text-gray-700">{review.content}</p>
                </div>
                {review.status === 'pending' && (
                  <div className="flex gap-2 ml-4">
                    <button className="px-3 py-1 text-sm text-green-600 border border-green-600 rounded hover:bg-green-50">
                      Goedkeuren
                    </button>
                    <button className="px-3 py-1 text-sm text-red-600 border border-red-600 rounded hover:bg-red-50">
                      Afwijzen
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
