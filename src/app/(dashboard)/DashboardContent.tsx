'use client'

import { useState, useEffect } from 'react'
import { ReviewsChart } from '@/components/ReviewsChart'
import Link from 'next/link'

interface UpcomingReview {
  id: string
  reviewerName: string
  rating: number
  content: string
  scheduledAt: string
  productName: string | null
  shopName: string | null
}

interface Stats {
  shops: number
  products: number
  pending: number
  approved: number
  posted: number
  failed: number
  imported: number
  totalGenerated: number
  upcomingReviews: UpcomingReview[]
}

export function DashboardContent() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/stats/dashboard')
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const StatCard = ({ 
    label, 
    value, 
    color = 'text-gray-900' 
  }: { 
    label: string
    value: number | string
    color?: string 
  }) => (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="text-sm font-medium text-gray-500">{label}</div>
      <div className={`mt-1 text-3xl font-semibold ${color}`}>
        {loading ? (
          <div className="h-9 w-16 bg-gray-200 rounded animate-pulse" />
        ) : (
          value
        )}
      </div>
    </div>
  )

  return (
    <>
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard 
          label="Shops" 
          value={stats?.shops ?? 0} 
        />
        <StatCard 
          label="Producten" 
          value={stats?.products ?? 0} 
        />
        <StatCard 
          label="Reviews (pending)" 
          value={stats?.pending ?? 0} 
          color="text-yellow-600" 
        />
        <StatCard 
          label="Reviews (gepost)" 
          value={stats?.posted ?? 0} 
          color="text-green-600" 
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard 
          label="Goedgekeurd" 
          value={stats?.approved ?? 0} 
          color="text-blue-600" 
        />
        <StatCard 
          label="Gefaald" 
          value={stats?.failed ?? 0} 
          color="text-red-600" 
        />
        <StatCard 
          label="Geïmporteerd" 
          value={stats?.imported ?? 0} 
          color="text-purple-600" 
        />
        <StatCard 
          label="Totaal gegenereerd" 
          value={stats?.totalGenerated ?? 0} 
        />
      </div>

      {/* Reviews Over Time Chart */}
      <ReviewsChart />

      {/* Coming Up Next */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">⏰ Coming Up Next</h2>
          <Link 
            href="/reviews/queue"
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            Alle bekijken →
          </Link>
        </div>
        
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : stats?.upcomingReviews && stats.upcomingReviews.length > 0 ? (
          <div className="space-y-3">
            {stats.upcomingReviews.map((review) => (
              <Link
                key={review.id}
                href={`/reviews/${review.id}`}
                className="block p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">{review.reviewerName}</span>
                      <span className="text-yellow-500">
                        {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 truncate">{review.content}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                      {review.shopName && <span>{review.shopName}</span>}
                      {review.productName && (
                        <>
                          <span>•</span>
                          <span className="truncate">{review.productName}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right ml-4 flex-shrink-0">
                    <div className="text-sm font-medium text-purple-600">
                      {new Date(review.scheduledAt).toLocaleDateString('nl-NL', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(review.scheduledAt).toLocaleTimeString('nl-NL', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>Geen geplande reviews</p>
            <p className="text-sm mt-1">Reviews worden automatisch ingepland na goedkeuring</p>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Snelle acties</h2>
        <div className="flex flex-wrap gap-4">
          <a
            href="/shops"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            Shop toevoegen
          </a>
          <a
            href="/reviews"
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            Reviews bekijken
          </a>
        </div>
      </div>
    </>
  )
}
