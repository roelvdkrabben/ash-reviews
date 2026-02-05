'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface ScheduledReview {
  review: {
    id: string
    reviewerName: string
    rating: number
    title: string | null
    content: string
    status: string
    scheduledAt: string
    createdAt: string
  }
  product: {
    id: string
    name: string
    imageUrl: string | null
  } | null
}

interface ScheduledReviewsData {
  reviews: ScheduledReview[]
  grouped: Record<string, ScheduledReview[]>
  stats: {
    total: number
    pending: number
    approved: number
    thisWeek: number
  }
}

interface Props {
  shopId: string
}

const WEEKDAYS = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za']
const MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
}

function isToday(dateStr: string): boolean {
  const today = new Date().toISOString().split('T')[0]
  return dateStr === today
}

function isTomorrow(dateStr: string): boolean {
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]
  return dateStr === tomorrow
}

function getDayLabel(dateStr: string): string {
  if (isToday(dateStr)) return 'Vandaag'
  if (isTomorrow(dateStr)) return 'Morgen'
  return formatDate(dateStr)
}

export default function ScheduledReviewsTimeline({ shopId }: Props) {
  const [data, setData] = useState<ScheduledReviewsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved'>('all')
  const [expanded, setExpanded] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const url = statusFilter === 'all'
          ? `/api/shops/${shopId}/scheduled-reviews`
          : `/api/shops/${shopId}/scheduled-reviews?status=${statusFilter}`
        const res = await fetch(url)
        if (!res.ok) throw new Error('Failed to fetch')
        const json = await res.json()
        setData(json)
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [shopId, statusFilter])

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">📅 Geplande Reviews</h2>
        </div>
        <div className="px-6 py-8 flex justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">📅 Geplande Reviews</h2>
        </div>
        <div className="px-6 py-4">
          <div className="text-red-600 text-sm">{error}</div>
        </div>
      </div>
    )
  }

  const dates = Object.keys(data?.grouped || {}).sort()

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-medium text-gray-900">📅 Geplande Reviews</h2>
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-gray-400 hover:text-gray-600"
            >
              {expanded ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              )}
            </button>
          </div>
          
          {/* Stats Pills */}
          {data?.stats && (
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                {data.stats.thisWeek} deze week
              </span>
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                {data.stats.total} totaal
              </span>
            </div>
          )}
        </div>
        
        {/* Filter tabs */}
        {expanded && (
          <div className="flex gap-1 mt-3">
            {(['all', 'pending', 'approved'] as const).map(status => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                  statusFilter === status
                    ? status === 'pending'
                      ? 'bg-yellow-100 text-yellow-800'
                      : status === 'approved'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-blue-100 text-blue-800'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                {status === 'all' && `Alle (${data?.stats.total || 0})`}
                {status === 'pending' && `Wachtend (${data?.stats.pending || 0})`}
                {status === 'approved' && `Goedgekeurd (${data?.stats.approved || 0})`}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Timeline content */}
      {expanded && (
        <div className="px-6 py-4">
          {dates.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-400 mb-2">
                <svg className="mx-auto h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-sm text-gray-500">Geen geplande reviews</p>
              <p className="text-xs text-gray-400 mt-1">Reviews verschijnen hier zodra ze zijn gegenereerd en ingepland</p>
            </div>
          ) : (
            <div className="space-y-4">
              {dates.map((date, dateIndex) => {
                const reviews = data!.grouped[date]
                const isCurrentDay = isToday(date)
                
                return (
                  <div key={date} className="relative">
                    {/* Date header */}
                    <div className={`flex items-center gap-2 mb-2 ${isCurrentDay ? 'text-blue-600' : 'text-gray-700'}`}>
                      <div className={`w-2 h-2 rounded-full ${isCurrentDay ? 'bg-blue-600' : 'bg-gray-400'}`}></div>
                      <span className="text-sm font-medium">{getDayLabel(date)}</span>
                      <span className="text-xs text-gray-400">({reviews.length} review{reviews.length !== 1 ? 's' : ''})</span>
                    </div>
                    
                    {/* Reviews for this date */}
                    <div className="ml-4 pl-4 border-l-2 border-gray-100 space-y-2">
                      {reviews.map((item, idx) => (
                        <div
                          key={item.review.id}
                          className={`p-3 rounded-lg border transition-all hover:shadow-sm ${
                            item.review.status === 'pending'
                              ? 'bg-yellow-50 border-yellow-200'
                              : 'bg-green-50 border-green-200'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              {/* Time and status */}
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-medium text-gray-700">
                                  {formatTime(item.review.scheduledAt)}
                                </span>
                                <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
                                  item.review.status === 'pending'
                                    ? 'bg-yellow-200 text-yellow-800'
                                    : 'bg-green-200 text-green-800'
                                }`}>
                                  {item.review.status === 'pending' ? 'Wachtend' : 'Goedgekeurd'}
                                </span>
                              </div>
                              
                              {/* Product name */}
                              {item.product && (
                                <p className="text-sm text-gray-600 truncate mb-1">
                                  {item.product.name}
                                </p>
                              )}
                              
                              {/* Reviewer and rating */}
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">{item.review.reviewerName}</span>
                                <div className="flex">
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <svg
                                      key={star}
                                      className={`w-3 h-3 ${star <= item.review.rating ? 'text-yellow-400' : 'text-gray-300'}`}
                                      fill="currentColor"
                                      viewBox="0 0 20 20"
                                    >
                                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                    </svg>
                                  ))}
                                </div>
                              </div>
                            </div>
                            
                            {/* View button */}
                            <Link
                              href={`/reviews/${item.review.id}`}
                              className="shrink-0 px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-white/50 rounded"
                            >
                              Bekijk →
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Connector line to next date */}
                    {dateIndex < dates.length - 1 && (
                      <div className="ml-[3px] h-4 w-0.5 bg-gray-200"></div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
