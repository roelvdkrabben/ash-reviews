'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Review } from '@/lib/schema'

interface ReviewEditFormProps {
  review: Review
}

export function ReviewEditForm({ review }: ReviewEditFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  
  const [formData, setFormData] = useState({
    reviewerName: review.reviewerName,
    rating: review.rating,
    title: review.title || '',
    content: review.content,
    status: review.status,
    scheduledAt: review.scheduledAt 
      ? new Date(review.scheduledAt).toISOString().slice(0, 16) 
      : ''
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await fetch(`/api/reviews/${review.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          scheduledAt: formData.scheduledAt || null
        })
      })

      if (!res.ok) {
        throw new Error('Failed to update review')
      }

      router.refresh()
      router.push('/reviews')
    } catch (error) {
      console.error('Error updating review:', error)
      alert('Kon review niet bijwerken')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Weet je zeker dat je deze review wilt verwijderen?')) {
      return
    }

    setDeleting(true)

    try {
      const res = await fetch(`/api/reviews/${review.id}`, {
        method: 'DELETE'
      })

      if (!res.ok) {
        throw new Error('Failed to delete review')
      }

      router.push('/reviews')
    } catch (error) {
      console.error('Error deleting review:', error)
      alert('Kon review niet verwijderen')
    } finally {
      setDeleting(false)
    }
  }

  async function handleQuickAction(status: 'approved' | 'failed') {
    setLoading(true)

    try {
      const res = await fetch(`/api/reviews/${review.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })

      if (!res.ok) {
        throw new Error('Failed to update review')
      }

      router.refresh()
      router.push('/reviews')
    } catch (error) {
      console.error('Error updating review:', error)
      alert('Kon review niet bijwerken')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Quick actions for pending reviews */}
      {review.status === 'pending' && (
        <div className="flex gap-3 pb-4 border-b">
          <button
            type="button"
            onClick={() => handleQuickAction('approved')}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            ✓ Goedkeuren
          </button>
          <button
            type="button"
            onClick={() => handleQuickAction('failed')}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            ✕ Afwijzen
          </button>
        </div>
      )}

      {/* Reviewer name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Reviewer naam
        </label>
        <input
          type="text"
          value={formData.reviewerName}
          onChange={(e) => setFormData({ ...formData, reviewerName: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          required
        />
      </div>

      {/* Rating */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Rating
        </label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setFormData({ ...formData, rating: star })}
              className="p-1"
            >
              <svg
                className={`w-8 h-8 ${star <= formData.rating ? 'text-yellow-400' : 'text-gray-300'}`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </button>
          ))}
        </div>
      </div>

      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Titel
        </label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Optioneel"
        />
      </div>

      {/* Content */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Review tekst
        </label>
        <textarea
          value={formData.content}
          onChange={(e) => setFormData({ ...formData, content: e.target.value })}
          rows={5}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          required
        />
      </div>

      {/* Status */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Status
        </label>
        <select
          value={formData.status}
          onChange={(e) => setFormData({ ...formData, status: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="pending">Wachtend</option>
          <option value="approved">Goedgekeurd</option>
          <option value="posted">Gepost</option>
          <option value="failed">Mislukt</option>
        </select>
      </div>

      {/* Schedule */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Inplannen voor
        </label>
        <input
          type="datetime-local"
          value={formData.scheduledAt}
          onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <p className="text-xs text-gray-500 mt-1">
          Laat leeg om niet in te plannen
        </p>
      </div>

      {/* Actions */}
      <div className="flex justify-between pt-4 border-t">
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting || loading}
          className="px-4 py-2 text-sm font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-50 disabled:opacity-50"
        >
          {deleting ? 'Verwijderen...' : 'Verwijderen'}
        </button>
        
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Annuleren
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Opslaan...' : 'Opslaan'}
          </button>
        </div>
      </div>
    </form>
  )
}
