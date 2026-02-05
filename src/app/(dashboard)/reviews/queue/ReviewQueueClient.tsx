'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import type { reviews, products, shops } from '@/lib/schema'

interface ReviewWithRelations {
  review: typeof reviews.$inferSelect
  product: typeof products.$inferSelect | null
  shop: typeof shops.$inferSelect | null
}

interface ReviewQueueClientProps {
  reviews: ReviewWithRelations[]
  shops: Array<typeof shops.$inferSelect>
  currentShopFilter: string
}

export function ReviewQueueClient({ reviews: initialReviews, shops, currentShopFilter }: ReviewQueueClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [reviewList, setReviewList] = useState(initialReviews)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [focusedIndex, setFocusedIndex] = useState(0)
  const [loading, setLoading] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null)

  // Update list when props change
  useEffect(() => {
    setReviewList(initialReviews)
    setSelectedIds(new Set())
    setFocusedIndex(0)
  }, [initialReviews])

  const handleApprove = async (id: string) => {
    setLoading(id)
    try {
      const res = await fetch(`/api/reviews/${id}/approve`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to approve')
      
      // Remove from local list
      setReviewList(prev => prev.filter(r => r.review.id !== id))
      setSelectedIds(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    } catch (e) {
      console.error(e)
      alert('Kon review niet goedkeuren')
    } finally {
      setLoading(null)
    }
  }

  const handleReject = async (id: string, reason?: string) => {
    setLoading(id)
    try {
      const res = await fetch(`/api/reviews/${id}/reject`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      })
      if (!res.ok) throw new Error('Failed to reject')
      
      // Remove from local list
      setReviewList(prev => prev.filter(r => r.review.id !== id))
      setSelectedIds(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      setShowRejectModal(null)
      setRejectReason('')
    } catch (e) {
      console.error(e)
      alert('Kon review niet afwijzen')
    } finally {
      setLoading(null)
    }
  }

  const handleBulkAction = async (action: 'approve' | 'reject') => {
    if (selectedIds.size === 0) return
    
    setLoading('bulk')
    try {
      const res = await fetch('/api/reviews/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ids: Array.from(selectedIds), 
          action,
          reason: action === 'reject' ? 'Bulk afgewezen' : undefined
        })
      })
      if (!res.ok) throw new Error('Failed to bulk update')
      
      // Remove from local list
      setReviewList(prev => prev.filter(r => !selectedIds.has(r.review.id)))
      setSelectedIds(new Set())
    } catch (e) {
      console.error(e)
      alert(`Kon reviews niet ${action === 'approve' ? 'goedkeuren' : 'afwijzen'}`)
    } finally {
      setLoading(null)
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const selectAll = () => {
    setSelectedIds(new Set(reviewList.map(r => r.review.id)))
  }

  const deselectAll = () => {
    setSelectedIds(new Set())
  }

  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't handle if typing in input/textarea or modal is open
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || showRejectModal) {
      return
    }

    const currentReview = reviewList[focusedIndex]
    if (!currentReview && reviewList.length > 0) return

    switch (e.key.toLowerCase()) {
      case 'arrowdown':
      case 'j':
        e.preventDefault()
        setFocusedIndex(prev => Math.min(prev + 1, reviewList.length - 1))
        break
      case 'arrowup':
      case 'k':
        e.preventDefault()
        setFocusedIndex(prev => Math.max(prev - 1, 0))
        break
      case 'a':
        if (currentReview && !loading) {
          e.preventDefault()
          handleApprove(currentReview.review.id)
        }
        break
      case 'r':
        if (currentReview && !loading) {
          e.preventDefault()
          setShowRejectModal(currentReview.review.id)
        }
        break
      case 'e':
        if (currentReview) {
          e.preventDefault()
          router.push(`/reviews/${currentReview.review.id}`)
        }
        break
      case ' ':
        if (currentReview) {
          e.preventDefault()
          toggleSelect(currentReview.review.id)
        }
        break
    }
  }, [focusedIndex, reviewList, loading, showRejectModal, router])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Shop filter change
  const handleShopChange = (shopId: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (shopId === 'all') {
      params.delete('shop')
    } else {
      params.set('shop', shopId)
    }
    router.push(`/reviews/queue?${params.toString()}`)
  }

  return (
    <>
      {/* Controls */}
      <div className="flex items-center justify-between bg-white rounded-lg shadow p-4">
        <div className="flex items-center gap-4">
          {/* Shop filter */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Shop:</label>
            <select
              value={currentShopFilter}
              onChange={(e) => handleShopChange(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Alle shops</option>
              {shops.map(shop => (
                <option key={shop.id} value={shop.id}>{shop.name}</option>
              ))}
            </select>
          </div>

          {/* Selection controls */}
          <div className="flex items-center gap-3 border-l pl-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedIds.size === reviewList.length && reviewList.length > 0}
                ref={(el) => {
                  if (el) {
                    el.indeterminate = selectedIds.size > 0 && selectedIds.size < reviewList.length
                  }
                }}
                onChange={(e) => {
                  if (e.target.checked) {
                    selectAll()
                  } else {
                    deselectAll()
                  }
                }}
                className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-600">
                {selectedIds.size === 0 
                  ? 'Alles selecteren' 
                  : `${selectedIds.size}/${reviewList.length} geselecteerd`}
              </span>
            </label>
          </div>
        </div>

        {/* Bulk actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleBulkAction('approve')}
            disabled={selectedIds.size === 0 || loading === 'bulk'}
            className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ✅ Goedkeuren ({selectedIds.size})
          </button>
          <button
            onClick={() => handleBulkAction('reject')}
            disabled={selectedIds.size === 0 || loading === 'bulk'}
            className="px-4 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ❌ Afwijzen ({selectedIds.size})
          </button>
        </div>
      </div>

      {/* Keyboard shortcuts help */}
      <div className="text-xs text-gray-500 flex gap-4">
        <span>⌨️ Shortcuts:</span>
        <span><kbd className="px-1.5 py-0.5 bg-gray-100 rounded">↑↓</kbd> of <kbd className="px-1.5 py-0.5 bg-gray-100 rounded">j/k</kbd> = navigeren</span>
        <span><kbd className="px-1.5 py-0.5 bg-gray-100 rounded">A</kbd> = goedkeuren</span>
        <span><kbd className="px-1.5 py-0.5 bg-gray-100 rounded">R</kbd> = afwijzen</span>
        <span><kbd className="px-1.5 py-0.5 bg-gray-100 rounded">E</kbd> = bewerken</span>
        <span><kbd className="px-1.5 py-0.5 bg-gray-100 rounded">Space</kbd> = selecteren</span>
      </div>

      {/* Empty state */}
      {reviewList.length === 0 && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Wachtrij is leeg!</h3>
          <p className="text-gray-500">Alle reviews zijn beoordeeld.</p>
        </div>
      )}

      {/* Review cards */}
      <div className="space-y-3">
        {reviewList.map((item, index) => (
          <ReviewCard
            key={item.review.id}
            item={item}
            isSelected={selectedIds.has(item.review.id)}
            isFocused={index === focusedIndex}
            onToggleSelect={() => toggleSelect(item.review.id)}
            onApprove={() => handleApprove(item.review.id)}
            onReject={() => setShowRejectModal(item.review.id)}
            loading={loading === item.review.id}
          />
        ))}
      </div>

      {/* Reject modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Review afwijzen</h3>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reden voor afwijzing (optioneel)"
              className="w-full border border-gray-300 rounded-md p-3 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowRejectModal(null)
                  setRejectReason('')
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Annuleren
              </button>
              <button
                onClick={() => handleReject(showRejectModal, rejectReason)}
                disabled={loading === showRejectModal}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {loading === showRejectModal ? 'Bezig...' : 'Afwijzen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

interface ReviewCardProps {
  item: ReviewWithRelations
  isSelected: boolean
  isFocused: boolean
  onToggleSelect: () => void
  onApprove: () => void
  onReject: () => void
  loading: boolean
}

function ReviewCard({ item, isSelected, isFocused, onToggleSelect, onApprove, onReject, loading }: ReviewCardProps) {
  const { review, product, shop } = item

  return (
    <div 
      className={`bg-white rounded-lg shadow p-5 transition-all ${
        isFocused ? 'ring-2 ring-blue-500 shadow-md' : ''
      } ${isSelected ? 'bg-blue-50' : ''}`}
    >
      <div className="flex gap-4">
        {/* Checkbox */}
        <div className="flex items-start pt-1">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-3 mb-2">
            {/* Stars */}
            <div className="flex">
              {[1, 2, 3, 4, 5].map((star) => (
                <svg
                  key={star}
                  className={`w-5 h-5 ${star <= review.rating ? 'text-yellow-400' : 'text-gray-300'}`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            
            {/* Title */}
            {review.title && (
              <h3 className="font-semibold text-gray-900 truncate">&quot;{review.title}&quot;</h3>
            )}
          </div>

          {/* Meta */}
          <div className="text-sm text-gray-500 mb-2 flex flex-wrap gap-x-4 gap-y-1">
            <span>📦 {product?.name || 'Onbekend product'}</span>
            <span>🏪 {shop?.name || 'Onbekende shop'}</span>
            <span>👤 {review.reviewerName}</span>
          </div>

          {/* Content preview */}
          <p className="text-gray-700 line-clamp-2">{review.content}</p>

          {/* Scheduled date */}
          <p className="text-xs text-gray-400 mt-2">
            {review.scheduledAt ? (
              <>
                📅 Ingepland: {new Date(review.scheduledAt).toLocaleDateString('nl-NL', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </>
            ) : (
              <>
                Aangemaakt: {new Date(review.createdAt!).toLocaleDateString('nl-NL', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </>
            )}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 shrink-0">
          <button
            onClick={onApprove}
            disabled={loading}
            className="px-4 py-2 bg-green-100 text-green-700 rounded-md hover:bg-green-200 disabled:opacity-50 font-medium"
            title="Goedkeuren (A)"
          >
            ✅ Goedkeuren
          </button>
          <Link
            href={`/reviews/${review.id}`}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-center font-medium"
            title="Bewerken (E)"
          >
            ✏️ Bewerken
          </Link>
          <button
            onClick={onReject}
            disabled={loading}
            className="px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 disabled:opacity-50 font-medium"
            title="Afwijzen (R)"
          >
            ❌ Afwijzen
          </button>
        </div>
      </div>
    </div>
  )
}
